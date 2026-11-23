import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { auditoria } from "@/db/esquema";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { cerrarTurno, datosIngreso, funcionariaDe, horaDe, iniciarTurno, reportar } from "@/lib/ruta/ruta";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const F = ESCRITURA.funcionarias;
const L = ESCRITURA.limpieza;
const S = ESCRITURA.servicios;
const H = ESCRITURA.controlHoras;
const U = ESCRITURA.unidadesOperacion;
const HOY = "2026-11-25";

let db: Db;
let at: AirtableFalso;
const edy: Sesion = {
  usuarioId: "00000000-0000-0000-0000-000000000007",
  correo: "edy@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Edy Borre",
  accesos: { verse: plantilla("aseo").casillas },
  estructura: ESTRUCTURA,
};
const sinRuta: Sesion = { ...edy, correo: "otra@prueba.co", nombreAirtable: "Otra", accesos: { verse: plantilla("living").casillas } };

let funcionaria: string;
let limpieza: string;
let unidad: string;

beforeEach(async () => {
  db = await dbDePrueba();
  at = new AirtableFalso();
  funcionaria = at.poner(F.idBase, F.idTabla, { Nombre: "Edy Borré", Activa: "checked", Correo: "", "Nombre en LIMPIEZA": "Edy Borrre", "Nombre en SERVICIOS": "Edy Borre", "Nombre en CONTROL HORAS": "Edy" }).id;
  unidad = at.poner(U.idBase, U.idTabla, { [U.campos.codigo.id]: "4321", [U.campos.wifiRed.id]: "Torre603", [U.campos.wifiClave.id]: "clave-prueba", [U.campos.metodo.id]: ["Teclado"] }).id;
  // Las consultas llegan por nombre (cellFormat string) y obtener por ID: la fila trae las dos.
  limpieza = at.poner(L.idBase, L.idTabla, { Unidad: "Torre Norte 603", Fecha: "25/11/2026 8:30am", Estado: "Programado", Comentario: "Salida", [L.campos.unidad.id]: [unidad], [L.campos.estado.id]: "Programado" }).id;
});

const filas = (t: { idBase: string; idTabla: string }) => [...(at.tablas.get(`${t.idBase}/${t.idTabla}`)?.values() ?? [])];

describe("Ruta de aseo", () => {
  it("reconoce a la funcionaria por nombre sin importar tildes", async () => {
    expect((await funcionariaDe(at, edy))?.recId).toBe(funcionaria);
    expect(await funcionariaDe(at, sinRuta)).toBeNull();
  });

  it("convierte la hora de Airtable", () => {
    expect(horaDe("25/11/2026 8:30am")).toBe("8:30 a. m.");
    expect(horaDe("25/11/2026 2:00pm")).toBe("2:00 p. m.");
    expect(horaDe("25/11/2026 14:00")).toBe("2:00 p. m.");
  });

  it("iniciar turno crea CONTROL HORAS con enlace y la opción del select; no deja abrir dos", async () => {
    const r = await iniciarTurno(db, at, edy, HOY, new Date("2026-11-25T13:05:00Z"));
    expect(r).toEqual({ ok: true, mensaje: "Turno iniciado" });
    const [t] = filas(H);
    expect(t?.fields).toMatchObject({ [H.campos.funcionariaEnlace.id]: [funcionaria], [H.campos.funcionaria.id]: "Edy", [H.campos.ingreso.id]: "2026-11-25T13:05:00.000Z" });
    // La consulta del turno lee por nombre: se simula lo que devolvería Airtable.
    t!.fields[H.campos.ingreso.nombre] = "25/11/2026 8:05am";
    expect((await iniciarTurno(db, at, edy, HOY)).mensaje).toBe("Ya tienes un turno abierto");
    expect((await cerrarTurno(db, at, edy, HOY, new Date("2026-11-25T22:00:00Z"))).ok).toBe(true);
    expect(t?.fields[H.campos.salida.id]).toBe("2026-11-25T22:00:00.000Z");
  });

  it("los códigos solo salen con el turno abierto y quedan en AUDITORIA", async () => {
    expect(await datosIngreso(db, at, edy, HOY, limpieza)).toEqual({ error: "Inicia el turno para ver los datos de ingreso" });
    await iniciarTurno(db, at, edy, HOY);
    const d = await datosIngreso(db, at, edy, HOY, limpieza);
    expect(d).toMatchObject({ codigo: "4321", wifiRed: "Torre603", metodo: "Teclado" });
    const accs = (await db.select().from(auditoria)).map((a) => a.accion);
    expect(accs).toContain("ruta.codigo_abierto");
    expect(await datosIngreso(db, at, sinRuta, HOY, limpieza)).toEqual({ error: "Tu acceso no incluye códigos" });
  });

  it("el reporte crea SERVICIOS y termina la limpieza; sin turno no se reporta", async () => {
    const base = { limpieza, tipo: "Inventario de Entrega" as const, estado: "Listo para entregar" as const, necesitaImplementos: true, implementos: "Jabón", danos: "Bombillo del baño" };
    expect((await reportar(db, at, edy, HOY, base)).mensaje).toBe("Inicia el turno antes de reportar");
    await iniciarTurno(db, at, edy, HOY);
    const r = await reportar(db, at, edy, HOY, { ...base, video: { url: "https://x.public.blob.vercel-storage.com/v.mp4", nombre: "v.mp4" } });
    expect(r).toEqual({ ok: true, mensaje: "Torre Norte 603 reportada y terminada" });
    const [s] = filas(S);
    expect(s?.fields).toMatchObject({
      [S.campos.unidad.id]: [unidad],
      [S.campos.funcionaria.id]: [funcionaria],
      [S.campos.funcionario.id]: "Edy Borre",
      [S.campos.necesitaImplementos.id]: "Si",
      [S.campos.danos.id]: "Bombillo del baño",
      [S.campos.video.id]: [{ url: "https://x.public.blob.vercel-storage.com/v.mp4", filename: "v.mp4" }],
    });
    expect(filas(L)[0]?.fields[L.campos.estado.id]).toBe("Terminado");
  });

  it("nadie fuera de la ruta escribe", async () => {
    expect((await iniciarTurno(db, at, sinRuta, HOY)).mensaje).toBe("No tienes la Ruta de aseo");
    const otra: Sesion = { ...edy, correo: "nueva@prueba.co", nombreAirtable: "Nueva" };
    expect((await iniciarTurno(db, at, otra, HOY)).mensaje).toContain("no está en FUNCIONARIAS");
  });
});

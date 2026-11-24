import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { auditoria } from "@/db/esquema";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { cambiarAseo, hora24, isoBogota, monto, programacion, programarAseo } from "@/lib/aseos/programacion";
import { ids } from "@/lib/modulos/tablas-equipo";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const F = ESCRITURA.funcionarias;
const L = ESCRITURA.limpieza;
const U = ESCRITURA.unidadesOperacion;
const R = ids("6. OPERACION 360", "RESERVAS");
const HOY = "2026-11-25";

const coordinacion: Sesion = {
  usuarioId: "00000000-0000-0000-0000-000000000011",
  correo: "diana@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Diana",
  accesos: { verse: plantilla("coordinacion-aseo").casillas },
  estructura: ESTRUCTURA,
};
const aseo: Sesion = { ...coordinacion, correo: "edy@prueba.co", accesos: { verse: plantilla("aseo").casillas } };

let db: Db;
let at: AirtableFalso;
let edy: string;
let inactiva: string;
let torre: string;
const filas = (t: { idBase: string; idTabla: string }) => [...(at.tablas.get(`${t.idBase}/${t.idTabla}`)?.values() ?? [])];

beforeEach(async () => {
  db = await dbDePrueba();
  at = new AirtableFalso();
  edy = at.poner(F.idBase, F.idTabla, { Nombre: "Edy Borré", Activa: "checked", Correo: "", "Nombre en LIMPIEZA": "Edy Borrre", "Nombre en SERVICIOS": "", "Nombre en CONTROL HORAS": "" }).id;
  inactiva = at.poner(F.idBase, F.idTabla, { Nombre: "Antigua", Activa: "", Correo: "", "Nombre en LIMPIEZA": "Antigua", "Nombre en SERVICIOS": "", "Nombre en CONTROL HORAS": "" }).id;
  // Las consultas leen por nombre y porIds/obtener por ID: la fila trae las dos.
  torre = at.poner(U.idBase, U.idTabla, { UND: "Torre Norte 603", [U.campos.und.id]: "Torre Norte 603", [U.campos.valorLimpieza.id]: 120000 }).id;
});

describe("programación de aseos", () => {
  it("convierte horas, montos y la hora de Bogotá a UTC", () => {
    expect(hora24("2:30 p. m.")).toBe("14:30");
    expect(hora24("12:00 a. m.")).toBe("00:00");
    expect(monto("$ 120.000")).toBe(120000);
    expect(monto("")).toBeNull();
    expect(isoBogota("2026-11-25", "11:00")).toBe("2026-11-25T16:00:00.000Z");
  });

  it("lista salidas sin aseo y aseos de la semana; la salida con aseo ese día no aparece", async () => {
    at.poner(R.idBase, R.idTabla, { Unidad: "Torre Norte 603", Salida: "2026-11-26" });
    at.poner(R.idBase, R.idTabla, { Unidad: "Parque 1104", Salida: "2026-11-27" });
    at.poner(L.idBase, L.idTabla, { Unidad: "Parque 1104", Fecha: "27/11/2026 2:00pm", "Funcionaria enlace": "", Funcionario: "", Estado: "Programado" });
    const p = await programacion(at, HOY);
    expect(p.funcionarias.map((f) => f.nombre)).toEqual(["Edy Borré"]);
    expect(p.porProgramar).toEqual([{ unidad: "Torre Norte 603", unidadRecId: torre, fecha: "2026-11-26" }]);
    expect(p.aseos).toMatchObject([{ unidad: "Parque 1104", fecha: "2026-11-27", hora: "14:00", funcionaria: "", terminado: false }]);
  });

  it("programa con unidad, fecha en UTC, aseadora en los dos campos, valor y pago pendiente; no repite el día", async () => {
    const r = await programarAseo(db, at, coordinacion, { unidad: torre, fecha: "2026-11-26", hora: "11:00", funcionaria: edy, comentario: "Salida de huésped" });
    expect(r).toEqual({ ok: true, mensaje: "Torre Norte 603 programado para el 26/11 11:00 con Edy Borré" });
    const [l] = filas(L);
    expect(l?.fields).toMatchObject({
      [L.campos.unidad.id]: [torre],
      [L.campos.fecha.id]: "2026-11-26T16:00:00.000Z",
      [L.campos.estado.id]: "Programado",
      [L.campos.funcionaria.id]: [edy],
      [L.campos.funcionario.id]: "Edy Borrre",
      [L.campos.total.id]: 120000,
      [L.campos.estadoPago.id]: "Pendiente",
      [L.campos.comentario.id]: "Salida de huésped",
    });
    const acciones = (await db.select().from(auditoria)).map((a) => [a.accion, a.autor]);
    expect(acciones).toContainEqual(["aseos.programado", "diana@prueba.co"]);
    // El falso no evalúa fórmulas: devuelve la fila recién creada, como haría Airtable para ese día.
    expect((await programarAseo(db, at, coordinacion, { unidad: torre, fecha: "2026-11-26", hora: "15:00" })).mensaje).toBe("Torre Norte 603 ya tiene un aseo ese día");
  });

  it("no programa sin permiso, con aseadora inactiva ni con datos inválidos", async () => {
    expect((await programarAseo(db, at, aseo, { unidad: torre, fecha: "2026-11-26", hora: "11:00" })).mensaje).toBe("No puedes programar aseos");
    expect((await programarAseo(db, at, coordinacion, { unidad: torre, fecha: "2026-11-26", hora: "11:00", funcionaria: inactiva })).mensaje).toBe("Esa aseadora no está activa en FUNCIONARIAS");
    expect((await programarAseo(db, at, coordinacion, { unidad: torre, fecha: "26/11", hora: "11:00" })).ok).toBe(false);
    expect((await programarAseo(db, at, coordinacion, { unidad: torre, fecha: "2026-11-26", hora: "25:00" })).ok).toBe(false);
    expect(filas(L)).toHaveLength(0);
  });

  it("cambia aseadora y hora con el valor que se veía; no toca un aseo terminado", async () => {
    const l = at.poner(L.idBase, L.idTabla, { [L.campos.estado.id]: "Programado", [L.campos.fecha.id]: "2026-11-26T16:00:00.000Z" }).id;
    expect(await cambiarAseo(db, at, coordinacion, { recId: l, funcionaria: edy, fecha: "2026-11-26", hora: "09:30" })).toEqual({ ok: true, mensaje: "Aseo actualizado" });
    const fila = filas(L).find((x) => x.id === l)!;
    expect(fila.fields).toMatchObject({ [L.campos.funcionaria.id]: [edy], [L.campos.funcionario.id]: "Edy Borrre", [L.campos.fecha.id]: "2026-11-26T14:30:00.000Z" });
    expect((await cambiarAseo(db, at, coordinacion, { recId: l, funcionaria: "" })).ok).toBe(true);
    expect(filas(L).find((x) => x.id === l)!.fields).toMatchObject({ [L.campos.funcionaria.id]: [], [L.campos.funcionario.id]: null });
    const t = at.poner(L.idBase, L.idTabla, { [L.campos.estado.id]: "Terminado" }).id;
    expect((await cambiarAseo(db, at, coordinacion, { recId: t, funcionaria: edy })).mensaje).toBe("Ese aseo ya está terminado");
    expect((await cambiarAseo(db, at, coordinacion, { recId: l, fecha: "2026-11-27" })).mensaje).toBe("Indica fecha y hora");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { guardarEdicion } from "@/lib/modulos/editar";
import { TABLAS_EQUIPO } from "@/lib/modulos/tablas-equipo";
import { crearTicket, ticketsDeReporte } from "@/lib/tickets/tickets";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const T = ESCRITURA.tickets;
const HOY = "2026-11-25";
const coordinacion: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000011", correo: "diana@prueba.co", estado: "activo", maestro: false, nombreAirtable: "Diana", accesos: { verse: plantilla("coordinacion-aseo").casillas }, estructura: ESTRUCTURA };
const living: Sesion = { ...coordinacion, accesos: { verse: plantilla("living").casillas } };

let db: Db;
let at: AirtableFalso;
const filas = () => [...(at.tablas.get(`${T.idBase}/${T.idTabla}`)?.values() ?? [])];

beforeEach(async () => {
  db = await dbDePrueba();
  at = new AirtableFalso();
});

describe("tickets", () => {
  it("abre un ticket con límite por prioridad y quién lo creó; sin permiso no", async () => {
    expect(await crearTicket(db, at, coordinacion, { titulo: "Ducha sin agua caliente", tipo: "Mantenimiento", prioridad: "Alta", responsable: "Diana" }, HOY)).toEqual({ ok: true, mensaje: "Ticket abierto" });
    expect(filas()[0]?.fields).toMatchObject({
      [T.campos.titulo.id]: "Ducha sin agua caliente",
      [T.campos.estado.id]: "Abierto",
      [T.campos.fechaLimite.id]: "2026-11-26",
      [T.campos.creadoPor.id]: "diana@prueba.co",
      [T.campos.responsable.id]: "Diana",
    });
    expect((await crearTicket(db, at, living, { titulo: "Algo", tipo: "Otro", prioridad: "Baja" }, HOY)).mensaje).toBe("No puedes abrir tickets");
    expect((await crearTicket(db, at, coordinacion, { titulo: "Algo", tipo: "Inventado", prioridad: "Baja" }, HOY)).mensaje).toBe("Elige el tipo");
  });

  it("un reporte listo sin novedades no abre tickets; con pendientes abre uno", () => {
    expect(ticketsDeReporte({ unidad: "Parque 1104", servicioRecId: null, estado: "Listo para entregar", necesitaImplementos: false }, HOY)).toEqual([]);
    const [t] = ticketsDeReporte({ unidad: "Parque 1104", servicioRecId: null, estado: "Actividades pendientes", necesitaImplementos: false, comentario: "Falta lavar cortinas" }, HOY);
    expect(t).toMatchObject({ [T.campos.titulo.id]: "Actividades pendientes en Parque 1104", [T.campos.comentario.id]: "Falta lavar cortinas", [T.campos.fechaLimite.id]: "2026-11-28" });
  });

  it("cerrar sella Cerrado el", async () => {
    const r = at.poner(T.idBase, T.idTabla, { [T.campos.estado.id]: "Abierto" });
    at.esquemas.set(T.idBase, [{ id: T.idTabla, name: "TICKETS", fields: [{ id: T.campos.estado.id, name: "Estado", type: "singleSelect", options: { choices: [{ name: "Abierto" }, { name: "En curso" }, { name: "Cerrado" }] } }] }] as never);
    const g = await guardarEdicion(db, at, coordinacion, "verse", "host-tickets", TABLAS_EQUIPO["tickets"]!.editar!, r.id, { estado: "Cerrado" }, { [T.campos.estado.id]: "Abierto" });
    expect(g.ok).toBe(true);
    const f = filas().find((x) => x.id === r.id)!.fields;
    expect(f[T.campos.estado.id]).toBe("Cerrado");
    expect(String(f[T.campos.cerradoEl.id])).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

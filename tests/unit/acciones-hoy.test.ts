import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { auditoria, tareas } from "@/db/esquema";
import { TABLAS } from "@/lib/airtable/mapeo";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { aplicarAccion, MARCA_APROBADO } from "@/lib/hoy/acciones";
import { reconciliar } from "@/lib/sync/reconciliar";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const TV = TABLAS.trazabilidadVerse;
const k = TV.campos;
const AHORA = new Date("2026-11-25T15:00:00Z");

const sesion = (accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: "u",
  correo: "diana@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Diana",
  accesos,
  ...extra,
});
const maestro = sesion({}, { maestro: true, correo: "felipe@prueba.co", nombreAirtable: "Felipe" });

let db: Db;
let at: AirtableFalso;
let deDiana: string;
let deFelipe: string;
let aprobar: string;

beforeEach(async () => {
  db = await dbDePrueba();
  at = new AirtableFalso();
  const base = { [k.tipo.id]: "Pendiente", [k.estado.id]: "Abierto", [k.fechaLimite.id]: "2026-11-25", [k.proceso.id]: "Limpiezas" };
  deDiana = at.poner(TV.idBase, TV.idTabla, { ...base, [k.asunto.id]: "De Diana", [k.responsable.id]: "Diana", [k.detalle.id]: "Revisar algo" }).id;
  deFelipe = at.poner(TV.idBase, TV.idTabla, { ...base, [k.asunto.id]: "De Felipe", [k.responsable.id]: "Felipe", [k.detalle.id]: "Revisar otra cosa" }).id;
  aprobar = at.poner(TV.idBase, TV.idTabla, { ...base, [k.asunto.id]: "Cambio de cruce", [k.responsable.id]: "Felipe", [k.detalle.id]: "Aprobar: CRUCES de 10 a 12" }).id;
  await reconciliar(db, at, "trazabilidadVerse");
});

const enAirtable = (id: string) => at.tablas.get(`${TV.idBase}/${TV.idTabla}`)!.get(id)!.fields;

describe("acciones de Hoy", () => {
  it("cerrar deja Hecho en Airtable y en la copia, con autor en auditoría", async () => {
    const r = await aplicarAccion(db, at, maestro, deDiana, { tipo: "cerrar" }, AHORA);
    expect(r).toEqual({ ok: true, mensaje: "Cerrado" });
    expect(enAirtable(deDiana)[k.estado.id]).toBe("Hecho");
    expect((await db.select().from(tareas)).find((x) => x.recId === deDiana)?.estado).toBe("Hecho");
    expect((await db.select().from(auditoria))[0]).toMatchObject({ autor: "felipe@prueba.co", accion: "escritura.actualizar", recId: deDiana });
  });

  it("aplazar deja En espera con la nueva Fecha límite; no acepta hoy ni el pasado", async () => {
    expect((await aplicarAccion(db, at, maestro, deDiana, { tipo: "aplazar", hasta: "2026-11-25" }, AHORA)).ok).toBe(false);
    const r = await aplicarAccion(db, at, maestro, deDiana, { tipo: "aplazar", hasta: "2026-11-30" }, AHORA);
    expect(r.ok).toBe(true);
    expect(enAirtable(deDiana)).toMatchObject({ [k.estado.id]: "En espera", [k.fechaLimite.id]: "2026-11-30" });
  });

  it("descartar deja Descartado", async () => {
    await aplicarAccion(db, at, maestro, deDiana, { tipo: "descartar" }, AHORA);
    expect(enAirtable(deDiana)[k.estado.id]).toBe("Descartado");
  });

  it("con alcance 'lo suyo' solo cambia sus propios pendientes", async () => {
    const living = sesion({ verse: plantilla("living").casillas });
    expect((await aplicarAccion(db, at, living, deFelipe, { tipo: "cerrar" }, AHORA)).mensaje).toBe("Ese pendiente no es tuyo");
    expect((await aplicarAccion(db, at, living, deDiana, { tipo: "cerrar" }, AHORA)).ok).toBe(true);
  });

  it("sin el módulo Hoy en editar no cambia nada", async () => {
    const aseo = sesion({ verse: plantilla("aseo").casillas });
    expect((await aplicarAccion(db, at, aseo, deDiana, { tipo: "cerrar" }, AHORA)).ok).toBe(false);
    expect(enAirtable(deDiana)[k.estado.id]).toBe("Abierto");
  });

  it("si la fila cambió en Airtable, gana Airtable", async () => {
    enAirtable(deDiana)[k.estado.id] = "Hecho";
    const r = await aplicarAccion(db, at, maestro, deDiana, { tipo: "descartar" }, AHORA);
    expect(r).toEqual({ ok: false, mensaje: "La fila cambió en Airtable; quedó el valor de Airtable" });
    expect((await db.select().from(tareas)).find((x) => x.recId === deDiana)?.estado).toBe("Hecho");
  });
});

describe("Para aprobar", () => {
  it("aprobar deja la aprobación escrita en el Detalle y no cambia el Estado", async () => {
    const r = await aplicarAccion(db, at, maestro, aprobar, { tipo: "aprobar" }, AHORA);
    expect(r.ok).toBe(true);
    expect(enAirtable(aprobar)[k.detalle.id]).toBe(`Aprobar: CRUCES de 10 a 12\n${MARCA_APROBADO} por felipe@prueba.co el 2026-11-25`);
    expect(enAirtable(aprobar)[k.estado.id]).toBe("Abierto");
    expect((await aplicarAccion(db, at, maestro, aprobar, { tipo: "aprobar" }, AHORA)).mensaje).toBe("Esta aprobación ya se respondió");
  });

  it("rechazar la descarta y deja quién la rechazó", async () => {
    await aplicarAccion(db, at, maestro, aprobar, { tipo: "rechazar" }, AHORA);
    expect(enAirtable(aprobar)[k.estado.id]).toBe("Descartado");
    expect(String(enAirtable(aprobar)[k.detalle.id])).toContain("Rechazado en la app por felipe@prueba.co");
  });

  it("solo quien tiene la casilla Aprobar puede responder, y solo filas Aprobar", async () => {
    const admin = sesion({ verse: plantilla("administrador-verse").casillas });
    expect((await aplicarAccion(db, at, admin, aprobar, { tipo: "aprobar" }, AHORA)).mensaje).toBe("No tienes permiso para aprobar");
    expect((await aplicarAccion(db, at, maestro, deDiana, { tipo: "aprobar" }, AHORA)).mensaje).toBe("Esta fila no es una aprobación");
  });
});

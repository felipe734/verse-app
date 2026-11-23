import { beforeEach, describe, expect, it } from "vitest";
import { auditoria, colaEscrituras, tareas } from "@/db/esquema";
import type { Db } from "@/db/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { TABLAS } from "@/lib/airtable/mapeo";
import { reconciliar } from "@/lib/sync/reconciliar";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const TV = TABLAS.trazabilidadVerse;
const estado = TV.campos.estado.id;

describe("cola de escrituras", () => {
  let db: Db;
  let at: AirtableFalso;
  let recId: string;

  beforeEach(async () => {
    db = await dbDePrueba();
    at = new AirtableFalso();
    recId = at.poner(TV.idBase, TV.idTabla, { [TV.campos.asunto.id]: "Tarea de prueba", [estado]: "Pendiente" }).id;
    await reconciliar(db, at, "trazabilidadVerse");
  });

  const escribir = (esperado?: Record<string, unknown>) =>
    encolar(db, { idBase: TV.idBase, idTabla: TV.idTabla, recId, campos: { [estado]: "Hecho" }, esperado, autor: "prueba@verse" });

  it("envía a Airtable, actualiza la copia y deja auditoría con antes y después", async () => {
    await escribir({ [estado]: "Pendiente" });
    expect(at.llamadas).not.toContain("actualizar");

    const r = await procesarCola(db, at);
    expect(r).toEqual({ hechas: 1, rechazadas: 0, reintentos: 0 });
    expect((await db.select().from(tareas))[0]?.estado).toBe("Hecho");

    const [a] = await db.select().from(auditoria).orderBy(auditoria.id);
    expect(a).toMatchObject({ autor: "prueba@verse", accion: "escritura.actualizar", recId, antes: { [estado]: "Pendiente" }, despues: { [estado]: "Hecho" } });
  });

  it("si la fila cambió en Airtable, gana Airtable y se registra el rechazo", async () => {
    at.tablas.get(`${TV.idBase}/${TV.idTabla}`)!.get(recId)!.fields[estado] = "Descartado";
    await escribir({ [estado]: "Pendiente" });

    const r = await procesarCola(db, at);
    expect(r.rechazadas).toBe(1);
    expect(at.llamadas).not.toContain("actualizar");
    expect((await db.select().from(tareas))[0]?.estado).toBe("Descartado");
    const [fila] = await db.select().from(colaEscrituras);
    expect(fila?.estado).toBe("fallida");
    expect((await db.select().from(auditoria))[0]?.accion).toBe("escritura.rechazada");
  });

  it("reintenta cuando Airtable limita (429) y no pierde la escritura", async () => {
    await escribir();
    at.falloSiguiente = 429;
    const r = await procesarCola(db, at);
    expect(r.reintentos).toBe(1);
    const [fila] = await db.select().from(colaEscrituras);
    expect(fila).toMatchObject({ estado: "pendiente", intentos: 1 });
  });

  it("un error 422 de Airtable no se reintenta", async () => {
    await escribir();
    at.falloSiguiente = 422;
    const r = await procesarCola(db, at);
    expect(r.rechazadas).toBe(1);
  });

  it("crea filas nuevas y las guarda en la copia", async () => {
    await encolar(db, { idBase: TV.idBase, idTabla: TV.idTabla, campos: { [TV.campos.asunto.id]: "Nueva" }, autor: "prueba@verse" });
    const r = await procesarCola(db, at);
    expect(r.hechas).toBe(1);
    expect(await db.select().from(tareas)).toHaveLength(2);
  });
});

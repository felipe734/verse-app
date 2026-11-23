import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { registros, syncEstado, tareas, unidades } from "@/db/esquema";
import type { Db } from "@/db/cliente";
import { TABLAS } from "@/lib/airtable/mapeo";
import { reconciliar } from "@/lib/sync/reconciliar";
import { aplicarAviso, clavesConWebhook, firmaValida, mantenerWebhooks } from "@/lib/sync/webhooks";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const TV = TABLAS.trazabilidadVerse;
const UH = TABLAS.unidadesHost;
const c = TV.campos;

function tareaFalsa(asunto: string, estado = "Pendiente") {
  return {
    [c.id.id]: 1,
    [c.asunto.id]: asunto,
    [c.tipo.id]: "Pendiente",
    [c.estado.id]: estado,
    [c.responsable.id]: "Persona de prueba",
    [c.fechaLimite.id]: "2026-11-30",
    [c.corrida.id]: ["recCORRIDA0000001"],
  };
}

describe("sincronizador", () => {
  let db: Db;
  let at: AirtableFalso;

  beforeEach(async () => {
    db = await dbDePrueba();
    at = new AirtableFalso();
  });

  it("la primera reconciliación es la carga completa y proyecta tareas", async () => {
    at.poner(TV.idBase, TV.idTabla, tareaFalsa("Pagar servicio de prueba"));
    at.poner(TV.idBase, TV.idTabla, tareaFalsa("Revisar unidad de prueba"));

    const r = await reconciliar(db, at, "trazabilidadVerse");
    expect(r).toMatchObject({ filasAirtable: 2, filasCopia: 0, faltaban: 2, cuadra: false });

    const t = await db.select().from(tareas);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ empresa: "Verse", estado: "Pendiente", fechaLimite: "2026-11-30", corrida: ["recCORRIDA0000001"] });
  });

  it("la segunda reconciliación cuadra fila por fila", async () => {
    at.poner(TV.idBase, TV.idTabla, tareaFalsa("Tarea A"));
    await reconciliar(db, at, "trazabilidadVerse");
    const r = await reconciliar(db, at, "trazabilidadVerse");
    expect(r).toMatchObject({ faltaban: 0, sobraban: 0, distintas: 0, cuadra: true });
  });

  it("detecta y corrige filas distintas y sobrantes", async () => {
    const a = at.poner(TV.idBase, TV.idTabla, tareaFalsa("Tarea A"));
    const b = at.poner(TV.idBase, TV.idTabla, tareaFalsa("Tarea B"));
    await reconciliar(db, at, "trazabilidadVerse");

    a.fields[c.estado.id] = "Hecho";
    at.quitar(TV.idBase, TV.idTabla, b.id);
    const r = await reconciliar(db, at, "trazabilidadVerse");
    expect(r).toMatchObject({ distintas: 1, sobraban: 1, cuadra: false });

    const t = await db.select().from(tareas);
    expect(t).toHaveLength(1);
    expect(t[0]?.estado).toBe("Hecho");
    expect(await db.select().from(registros)).toHaveLength(1);
  });

  it("saca el edificio de la fórmula UND en unidades Host", async () => {
    const u = UH.campos;
    at.poner(UH.idBase, UH.idTabla, { [u.und.id]: "101 - Edificio Prueba", [u.unidad.id]: "101", [u.estado.id]: "Actual" });
    await reconciliar(db, at, "unidadesHost");
    const [fila] = await db.select().from(unidades);
    expect(fila).toMatchObject({ linea: "Host", unidad: "101", edificio: "Edificio Prueba", estado: "Actual" });
  });
});

describe("webhooks", () => {
  let db: Db;
  let at: AirtableFalso;

  beforeEach(async () => {
    db = await dbDePrueba();
    at = new AirtableFalso();
  });

  it("solo las tablas del workspace Verse llevan webhook, menos las que van solo de noche", () => {
    expect(clavesConWebhook().sort()).toEqual(["ingresosLivingCopia", "limpiezasHost", "reservasHost", "trazabilidadCyC", "trazabilidadVerse", "unidadesHost", "unidadesLiving"]);
  });

  it("apagados no crean nada en Airtable", async () => {
    const r = await mantenerWebhooks(db, at, { activos: false, url: "https://app.prueba/api/airtable/webhook" });
    expect(r.creados).toEqual([]);
    expect(at.webhooks).toEqual([]);
  });

  it("encendidos crean uno por tabla y después solo renuevan", async () => {
    const url = "https://app.prueba/api/airtable/webhook";
    const r1 = await mantenerWebhooks(db, at, { activos: true, url });
    expect(r1.creados).toHaveLength(7);
    const r2 = await mantenerWebhooks(db, at, { activos: true, url });
    expect(r2).toEqual({ creados: [], renovados: r1.creados });
    expect(at.webhooks).toHaveLength(7);
  });

  it("valida la firma HMAC del aviso", () => {
    const secreto = Buffer.from("secreto-de-prueba").toString("base64");
    const cuerpo = '{"webhook":{"id":"ach1"}}';
    const firma = createHmac("sha256", Buffer.from(secreto, "base64")).update(cuerpo).digest("hex");
    expect(firmaValida(cuerpo, `hmac-sha256=${firma}`, secreto)).toBe(true);
    expect(firmaValida(cuerpo, "hmac-sha256=00", secreto)).toBe(false);
    expect(firmaValida(cuerpo, null, secreto)).toBe(false);
  });

  it("un aviso trae las filas cambiadas, borra las destruidas y avanza el cursor", async () => {
    const vieja = at.poner(TV.idBase, TV.idTabla, tareaFalsa("Se va a borrar"));
    await reconciliar(db, at, "trazabilidadVerse");
    await mantenerWebhooks(db, at, { activos: true, url: "https://app.prueba/api/airtable/webhook" });
    const [estado] = await db.select().from(syncEstado).where(eq(syncEstado.clave, "trazabilidadVerse"));

    const nueva = at.poner(TV.idBase, TV.idTabla, tareaFalsa("Nueva"));
    at.quitar(TV.idBase, TV.idTabla, vieja.id);
    at.payloadsPendientes = [
      {
        timestamp: "2026-11-22T12:00:00.000Z",
        changedTablesById: { [TV.idTabla]: { createdRecordsById: { [nueva.id]: {} }, destroyedRecordIds: [vieja.id] } },
      },
    ];

    const r = await aplicarAviso(db, at, estado!.webhookId!);
    expect(r).toEqual({ guardadas: 1, borradas: 1, clave: "trazabilidadVerse", tocadas: [nueva.id] });
    const t = await db.select().from(tareas);
    expect(t.map((x) => x.asunto)).toEqual(["Nueva"]);
    const [despues] = await db.select().from(syncEstado).where(eq(syncEstado.clave, "trazabilidadVerse"));
    expect(despues?.webhookCursor).toBe(2);
  });
});

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { syncEstado } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import type { ClaveTabla } from "@/lib/airtable/definicion";
import { TABLAS } from "@/lib/airtable/mapeo";
import { borrar, guardar } from "./guardar";
import { CLAVES } from "./tablas";

/** Tablas que solo se copian de noche: cambian poco y no justifican un webhook. */
const SOLO_DE_NOCHE: ClaveTabla[] = ["unidadesOperacionCopia"];

/** Solo el workspace Verse recibe webhooks; C&C se lee al abrir el módulo y cada noche. */
export function clavesConWebhook(): ClaveTabla[] {
  return CLAVES.filter((c) => TABLAS[c].workspace === "Verse" && !SOLO_DE_NOCHE.includes(c));
}

export interface WebhookPlaneado {
  clave: ClaveTabla;
  base: string;
  tabla: string;
  idBase: string;
  idTabla: string;
  existe: boolean;
}

/** Lo que se crearía en Airtable. No escribe nada. */
export async function planWebhooks(db: Db): Promise<WebhookPlaneado[]> {
  const estados = await db.select().from(syncEstado);
  return clavesConWebhook().map((clave) => {
    const t = TABLAS[clave];
    return {
      clave,
      base: t.base,
      tabla: t.tabla,
      idBase: t.idBase,
      idTabla: t.idTabla,
      existe: Boolean(estados.find((e) => e.clave === clave)?.webhookId),
    };
  });
}

/**
 * Crea los webhooks que faltan (solo si `activos`) y renueva los existentes, que Airtable vence a los 7 días.
 * Crear un webhook es una escritura en la configuración de Airtable: va apagado hasta el OK de Felipe.
 */
export async function mantenerWebhooks(
  db: Db,
  cliente: ClienteAirtable,
  { activos, url }: { activos: boolean; url: string },
): Promise<{ creados: ClaveTabla[]; renovados: ClaveTabla[] }> {
  const creados: ClaveTabla[] = [];
  const renovados: ClaveTabla[] = [];
  for (const clave of clavesConWebhook()) {
    const { idBase, idTabla } = TABLAS[clave];
    const [estado] = await db.select().from(syncEstado).where(eq(syncEstado.clave, clave));
    if (estado?.webhookId) {
      const r = await cliente.renovarWebhook(idBase, estado.webhookId);
      await db.update(syncEstado).set({ webhookVence: new Date(r.expirationTime) }).where(eq(syncEstado.clave, clave));
      renovados.push(clave);
    } else if (activos) {
      const w = await cliente.crearWebhook(idBase, idTabla, url);
      await db
        .insert(syncEstado)
        .values({ clave, idBase, idTabla, webhookId: w.id, webhookMac: w.macSecretBase64, webhookVence: new Date(w.expirationTime) })
        .onConflictDoUpdate({
          target: syncEstado.clave,
          set: { webhookId: w.id, webhookMac: w.macSecretBase64, webhookVence: new Date(w.expirationTime), webhookCursor: 1 },
        });
      creados.push(clave);
    }
  }
  return { creados, renovados };
}

/** Airtable firma cada aviso con HMAC-SHA256 del cuerpo usando el secreto del webhook. */
export function firmaValida(cuerpo: string, encabezado: string | null, macSecretBase64: string): boolean {
  if (!encabezado?.startsWith("hmac-sha256=")) return false;
  const esperado = createHmac("sha256", Buffer.from(macSecretBase64, "base64")).update(cuerpo, "utf8").digest("hex");
  const recibido = encabezado.slice("hmac-sha256=".length);
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(recibido, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Procesa un aviso de webhook: lee los cambios desde el último cursor, vuelve a traer
 * las filas tocadas y borra las destruidas. Así la copia queda igual a Airtable.
 */
export async function aplicarAviso(
  db: Db,
  cliente: ClienteAirtable,
  webhookId: string,
): Promise<{ guardadas: number; borradas: number; clave?: ClaveTabla; tocadas: string[] }> {
  const [estado] = await db.select().from(syncEstado).where(eq(syncEstado.webhookId, webhookId));
  if (!estado) return { guardadas: 0, borradas: 0, tocadas: [] };
  const clave = estado.clave as ClaveTabla;
  const { idBase, idTabla } = TABLAS[clave];

  let cursor = estado.webhookCursor;
  let hayMas = true;
  let guardadas = 0;
  let borradas = 0;
  const todas: string[] = [];
  while (hayMas) {
    const r = await cliente.payloads(idBase, webhookId, cursor);
    const tocadas = new Set<string>();
    const destruidas = new Set<string>();
    for (const p of r.payloads) {
      const cambios = p.changedTablesById?.[idTabla];
      if (!cambios) continue;
      for (const id of Object.keys(cambios.createdRecordsById ?? {})) tocadas.add(id);
      for (const id of Object.keys(cambios.changedRecordsById ?? {})) tocadas.add(id);
      for (const id of cambios.destroyedRecordIds ?? []) destruidas.add(id);
    }
    for (const id of destruidas) tocadas.delete(id);

    const filas = await cliente.porIds(idBase, idTabla, [...tocadas]);
    await guardar(db, clave, filas);
    await borrar(db, clave, [...destruidas]);
    guardadas += filas.length;
    borradas += destruidas.size;
    todas.push(...filas.map((f) => f.id));

    cursor = r.cursor;
    hayMas = r.mightHaveMore;
    await db.update(syncEstado).set({ webhookCursor: cursor, error: null }).where(eq(syncEstado.clave, clave));
  }
  await db.update(syncEstado).set({ filas: sql`(select count(*) from registros where id_tabla = ${idTabla} and id_base = ${idBase})::int` }).where(eq(syncEstado.clave, clave));
  return { guardadas, borradas, clave, tocadas: todas };
}

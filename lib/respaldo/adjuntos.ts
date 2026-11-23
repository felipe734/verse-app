import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { respaldoAdjuntos, respaldos } from "@/db/esquema";
import type { ClienteAirtable, RegistroAirtable } from "@/lib/airtable/cliente";
import type { EsquemaTabla } from "@/lib/airtable/construir-mapeo";
import type { Drive } from "@/lib/google/drive";
import { nombreCarpeta } from "./plan";

export const MAX_INTENTOS_ADJUNTO = 3;
/** Los enlaces de Airtable duran unas 2 horas; pasada 1 hora se pide uno nuevo. */
const VIGENCIA_URL_MS = 60 * 60 * 1000;

interface AdjuntoAirtable {
  id: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
}

export interface TablaOrigen {
  idBase: string;
  idTabla: string;
  base: string;
  tabla: string;
}

/** Domingo en Bogotá: el día de los videos de SERVICIOS. */
export function esDomingo(fecha: string): boolean {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay() === 0;
}

const esVideo = (a: AdjuntoAirtable) => (a.type ?? "").startsWith("video/");

/**
 * Registra los adjuntos de una tabla que aún no están en Drive.
 * Los videos de SERVICIOS solo entran los domingos.
 */
export async function registrarAdjuntos(
  db: Db,
  origen: TablaOrigen,
  esquema: EsquemaTabla,
  registros: RegistroAirtable[],
  fecha: string,
): Promise<number> {
  const campos = esquema.fields.filter((c) => c.type === "multipleAttachments").map((c) => c.id);
  if (!campos.length) return 0;
  const videosHoy = origen.tabla !== "SERVICIOS" || esDomingo(fecha);

  const filas = [];
  for (const r of registros) {
    for (const idCampo of campos) {
      const lista = r.fields[idCampo];
      if (!Array.isArray(lista)) continue;
      for (const a of lista as AdjuntoAirtable[]) {
        if (!a?.id || !a.url) continue;
        if (esVideo(a) && !videosHoy) continue;
        filas.push({
          idAdjunto: a.id,
          ...origen,
          recId: r.id,
          idCampo,
          nombre: a.filename || a.id,
          tipo: a.type ?? null,
          bytes: a.size ?? null,
          url: a.url,
        });
      }
    }
  }
  let nuevos = 0;
  for (let i = 0; i < filas.length; i += 200) {
    const lote = filas.slice(i, i + 200);
    const insertados = await db
      .insert(respaldoAdjuntos)
      .values(lote)
      .onConflictDoUpdate({
        target: respaldoAdjuntos.idAdjunto,
        // Si sigue pendiente, se refresca el enlace con el recién traído.
        set: { url: sql`excluded.url`, urlTomada: sql`now()` },
        setWhere: sql`${respaldoAdjuntos.estado} = 'pendiente'`,
      })
      .returning({ id: respaldoAdjuntos.idAdjunto, guardado: respaldoAdjuntos.guardado });
    nuevos += insertados.filter((x) => !x.guardado).length;
  }
  return nuevos;
}

function nombreArchivo(id: string, nombre: string): string {
  return `${id}-${nombre.replace(/[\\/]/g, "-")}`.slice(0, 200);
}

/** Descarga de Airtable y sube a Drive por flujo, sin cargar el archivo en memoria. */
export async function guardarAdjuntos(
  deps: { db: Db; airtable: ClienteAirtable; drive: Drive; idUnidad: string; fetch?: typeof fetch; ahora?: () => number },
  fecha: string,
  limite: number,
): Promise<{ guardados: number; fallidos: number; pendientes: number }> {
  const { db, airtable, drive, idUnidad } = deps;
  const f = deps.fetch ?? fetch;
  const reloj = deps.ahora ?? Date.now;
  const carpetas = new Map<string, string>();
  let raiz: string | null = null;
  let guardados = 0;
  let fallidos = 0;

  while (reloj() < limite) {
    const [a] = await db
      .select()
      .from(respaldoAdjuntos)
      .where(and(eq(respaldoAdjuntos.estado, "pendiente"), lt(respaldoAdjuntos.intentos, MAX_INTENTOS_ADJUNTO)))
      .limit(1);
    if (!a) break;
    try {
      let url = a.url;
      if (reloj() - a.urlTomada.getTime() > VIGENCIA_URL_MS) {
        const fila = await airtable.obtener(a.idBase, a.idTabla, a.recId);
        const lista = (fila?.fields[a.idCampo] ?? []) as AdjuntoAirtable[];
        const actual = Array.isArray(lista) ? lista.find((x) => x.id === a.idAdjunto) : undefined;
        if (!actual) {
          // Ya no existe en Airtable: no hay nada que guardar.
          await db.delete(respaldoAdjuntos).where(eq(respaldoAdjuntos.idAdjunto, a.idAdjunto));
          continue;
        }
        url = actual.url;
      }

      const descarga = await f(url);
      if (!descarga.ok || !descarga.body) throw new Error(`Airtable respondió ${descarga.status} al descargar`);

      raiz ??= await drive.carpeta("Adjuntos", idUnidad);
      const claveCarpeta = `${a.idBase}/${a.idTabla}`;
      if (!carpetas.has(claveCarpeta)) {
        const base = await drive.carpeta(nombreCarpeta(a.base), raiz);
        carpetas.set(claveCarpeta, await drive.carpeta(nombreCarpeta(a.tabla), base));
      }
      const tamano = Number(descarga.headers.get("content-length")) || a.bytes || undefined;
      const idDrive = await drive.subirFlujo(
        nombreArchivo(a.idAdjunto, a.nombre),
        carpetas.get(claveCarpeta)!,
        descarga.body,
        a.tipo ?? descarga.headers.get("content-type") ?? "application/octet-stream",
        tamano,
      );
      await db
        .update(respaldoAdjuntos)
        .set({ estado: "guardado", idDrive, guardado: sql`now()`, error: null })
        .where(eq(respaldoAdjuntos.idAdjunto, a.idAdjunto));
      await db
        .update(respaldos)
        .set({ adjuntos: sql`${respaldos.adjuntos} + 1`, bytesAdjuntos: sql`${respaldos.bytesAdjuntos} + ${tamano ?? 0}` })
        .where(eq(respaldos.fecha, fecha));
      guardados++;
    } catch (e) {
      const agotado = a.intentos + 1 >= MAX_INTENTOS_ADJUNTO;
      await db
        .update(respaldoAdjuntos)
        .set({ intentos: a.intentos + 1, error: e instanceof Error ? e.message : "error", estado: agotado ? "fallido" : "pendiente" })
        .where(eq(respaldoAdjuntos.idAdjunto, a.idAdjunto));
      if (agotado) fallidos++;
    }
  }

  const [{ pendientes } = { pendientes: 0 }] = await db
    .select({ pendientes: sql<number>`count(*)::int` })
    .from(respaldoAdjuntos)
    .where(and(eq(respaldoAdjuntos.estado, "pendiente"), lt(respaldoAdjuntos.intentos, MAX_INTENTOS_ADJUNTO)));
  return { guardados, fallidos, pendientes };
}

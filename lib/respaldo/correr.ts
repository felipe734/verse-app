import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import {
  auditoria,
  colaEscrituras,
  costosNeon,
  llamadasAirtable,
  reconciliaciones,
  respaldos,
  respaldoTareas,
  syncEstado,
} from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import type { EsquemaTabla, FilaCatalogo } from "@/lib/airtable/construir-mapeo";
import type { Drive } from "@/lib/google/drive";
import { exportarTabla } from "./exportar";
import { carpetasAVencer, nombreCarpeta, tablasDelDia } from "./plan";

export const MAX_INTENTOS = 3;

export interface Dependencias {
  db: Db;
  airtable: ClienteAirtable;
  drive: Drive;
  idUnidad: string;
  ahora?: () => number;
}

/** Crea la fila del día y una tarea por tabla. Repetirlo no duplica nada. */
export async function prepararDia(db: Db, fecha: string, catalogo: readonly FilaCatalogo[]): Promise<number> {
  const tablas = tablasDelDia(catalogo, fecha);
  await db.insert(respaldos).values({ fecha, tablas: tablas.length }).onConflictDoNothing();
  if (tablas.length) {
    await db
      .insert(respaldoTareas)
      .values(tablas.map((t) => ({ fecha, idBase: t.idBase, idTabla: t.idTabla, base: t.base, tabla: t.tabla })))
      .onConflictDoNothing();
  }
  return tablas.length;
}

export interface ResultadoCorrida {
  hechas: number;
  fallidas: number;
  pendientes: number;
  terminado: boolean;
}

/** Procesa tareas pendientes hasta agotar el tiempo; al terminar cierra el día y aplica la retención. */
export async function procesarDia(deps: Dependencias, fecha: string, presupuestoMs: number): Promise<ResultadoCorrida> {
  const { db, airtable, drive, idUnidad } = deps;
  const reloj = deps.ahora ?? Date.now;
  const limite = reloj() + presupuestoMs;

  const carpetaDia = await drive.carpeta(fecha, idUnidad);
  await db.update(respaldos).set({ carpetaId: carpetaDia }).where(eq(respaldos.fecha, fecha));

  const esquemas = new Map<string, EsquemaTabla[]>();
  const carpetasBase = new Map<string, string>();
  let hechas = 0;
  let fallidas = 0;

  while (reloj() < limite) {
    const [t] = await db
      .select()
      .from(respaldoTareas)
      .where(and(eq(respaldoTareas.fecha, fecha), eq(respaldoTareas.estado, "pendiente"), lt(respaldoTareas.intentos, MAX_INTENTOS)))
      .limit(1);
    if (!t) break;
    const clave = and(eq(respaldoTareas.fecha, fecha), eq(respaldoTareas.idBase, t.idBase), eq(respaldoTareas.idTabla, t.idTabla));
    try {
      if (!esquemas.has(t.idBase)) esquemas.set(t.idBase, await airtable.esquema(t.idBase));
      const esquema = esquemas.get(t.idBase)!.find((x) => x.id === t.idTabla);
      if (!esquema) throw new Error("la tabla ya no existe en Airtable");

      const registros = await airtable.todos(t.idBase, t.idTabla);
      const exp = exportarTabla(esquema, registros, { base: t.base, tabla: t.tabla, idBase: t.idBase, idTabla: t.idTabla, fecha });

      if (!carpetasBase.has(t.idBase)) carpetasBase.set(t.idBase, await drive.carpeta(nombreCarpeta(t.base), carpetaDia));
      const carpeta = carpetasBase.get(t.idBase)!;
      const nombre = nombreCarpeta(t.tabla);
      await drive.subir(`${nombre}.json`, carpeta, exp.json, "application/json");
      await drive.subir(`${nombre}.csv`, carpeta, exp.csv, "text/csv");

      const bytes = exp.json.length + exp.csv.length;
      await db.update(respaldoTareas).set({ estado: "hecha", filas: exp.filas, bytes, error: null, actualizado: sql`now()` }).where(clave);
      await db
        .update(respaldos)
        .set({ hechas: sql`${respaldos.hechas} + 1`, filas: sql`${respaldos.filas} + ${exp.filas}`, bytes: sql`${respaldos.bytes} + ${bytes}` })
        .where(eq(respaldos.fecha, fecha));
      hechas++;
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "error";
      const agotada = t.intentos + 1 >= MAX_INTENTOS;
      await db
        .update(respaldoTareas)
        .set({ intentos: t.intentos + 1, error: mensaje, estado: agotada ? "fallida" : "pendiente", actualizado: sql`now()` })
        .where(clave);
      if (agotada) {
        await db.update(respaldos).set({ fallidas: sql`${respaldos.fallidas} + 1` }).where(eq(respaldos.fecha, fecha));
        fallidas++;
      }
    }
  }

  const [{ pendientes } = { pendientes: 0 }] = await db
    .select({ pendientes: sql<number>`count(*)::int` })
    .from(respaldoTareas)
    .where(and(eq(respaldoTareas.fecha, fecha), eq(respaldoTareas.estado, "pendiente")));

  if (pendientes > 0) return { hechas, fallidas, pendientes, terminado: false };

  await respaldarApp(db, drive, carpetaDia, fecha);
  const [dia] = await db.select().from(respaldos).where(eq(respaldos.fecha, fecha));
  await db
    .update(respaldos)
    .set({ estado: (dia?.fallidas ?? 0) > 0 ? "con_fallas" : "completo", fin: sql`now()` })
    .where(eq(respaldos.fecha, fecha));
  await aplicarRetencion(drive, idUnidad);
  return { hechas, fallidas, pendientes: 0, terminado: true };
}

/** Las tablas propias de la app también van al respaldo; nunca los secretos de los webhooks. */
async function respaldarApp(db: Db, drive: Drive, carpetaDia: string, fecha: string): Promise<void> {
  const carpeta = await drive.carpeta("_app", carpetaDia);
  const estado = await db.select().from(syncEstado);
  const tablas: Record<string, unknown[]> = {
    auditoria: await db.select().from(auditoria),
    cola_escrituras: await db.select().from(colaEscrituras),
    reconciliaciones: await db.select().from(reconciliaciones),
    llamadas_airtable: await db.select().from(llamadasAirtable),
    costos_neon: await db.select().from(costosNeon),
    sync_estado: estado.map((fila) => ({ ...fila, webhookMac: undefined })),
  };
  for (const [nombre, filas] of Object.entries(tablas)) {
    await drive.subir(`${nombre}.json`, carpeta, JSON.stringify({ fecha, filas }), "application/json");
  }
}

export async function aplicarRetencion(drive: Drive, idUnidad: string): Promise<string[]> {
  const carpetas = await drive.carpetas(idUnidad);
  const vencen = new Set(carpetasAVencer(carpetas.map((c) => c.name)));
  const papelera = carpetas.filter((c) => vencen.has(c.name));
  for (const c of papelera) await drive.aPapelera(c.id);
  return papelera.map((c) => c.name);
}

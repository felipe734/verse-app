import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { reconciliaciones, registros, syncEstado, unidades } from "@/db/esquema";
import type { ClaveTabla } from "@/lib/airtable/definicion";
import { TABLAS } from "@/lib/airtable/mapeo";

/**
 * Lectura desde las copias de Postgres (RESERVAS, LIMPIEZA, INGRESOS) en vez de Airtable.
 * Solo se usa con LECTURA_COPIA=1 y si cada copia cuadró con Airtable las últimas tres
 * noches y tiene su webhook al día. Si no, quien llama sigue con Airtable.
 */
export const COPIAS_ALERTAS = ["reservasHost", "limpiezasHost", "ingresosLivingCopia"] as const satisfies ClaveTabla[];
type ClaveCopia = (typeof COPIAS_ALERTAS)[number] | "unidadesOperacionCopia";

export function lecturaCopiaActiva(): boolean {
  return process.env.LECTURA_COPIA === "1";
}

/** Si la copia de estas tablas se puede leer: tres noches seguidas cuadrando y webhook vigente. */
export async function copiaLista(db: Db, claves: readonly ClaveTabla[], ahora = new Date()): Promise<boolean> {
  if (!lecturaCopiaActiva()) return false;
  for (const clave of claves) {
    const ultimas = await db
      .select({ cuadra: reconciliaciones.cuadra })
      .from(reconciliaciones)
      .where(eq(reconciliaciones.clave, clave))
      .orderBy(desc(reconciliaciones.cuando))
      .limit(3);
    if (ultimas.length < 3 || !ultimas.every((r) => r.cuadra)) return false;
    const [e] = await db.select().from(syncEstado).where(eq(syncEstado.clave, clave));
    if (!e?.webhookId || !e.webhookVence || e.webhookVence < ahora) return false;
  }
  return true;
}

const campo = (clave: ClaveCopia, k: string): string => {
  const c = (TABLAS[clave].campos as Record<string, { id: string }>)[k];
  if (!c) throw new Error(`${clave}.${k} no está en el mapeo`);
  return c.id;
};

/** El día en Bogotá del campo: las fechas vienen como "AAAA-MM-DD" y las fechas con hora en UTC. */
export function diaDe(idCampo: string): SQL<string> {
  const v = sql`(${registros.campos}->>${idCampo})`;
  return sql<string>`(case when length(${v}) = 10 then ${v}::date else (${v}::timestamptz at time zone 'America/Bogota')::date end)`;
}

export interface FilaCopia {
  recId: string;
  /** Día del campo de fecha pedido, AAAA-MM-DD. */
  dia: string;
  campos: Record<string, unknown>;
}

/** Filas de una copia cuyo campo de fecha cae en [desde, hasta) (hasta abierto si falta). */
export async function filasPorFecha(
  db: Db,
  clave: ClaveCopia,
  fecha: string,
  rango: { desde?: string; hasta?: string },
  extra: SQL[] = [],
): Promise<FilaCopia[]> {
  const { idBase, idTabla } = TABLAS[clave];
  const id = campo(clave, fecha);
  const dia = diaDe(id);
  const filas = await db
    .select({ recId: registros.recId, dia: sql<string>`${dia}::text`, campos: registros.campos })
    .from(registros)
    .where(
      and(
        eq(registros.idBase, idBase),
        eq(registros.idTabla, idTabla),
        sql`coalesce(${registros.campos}->>${id}, '') <> ''`,
        rango.desde ? sql`${dia} >= ${rango.desde}::date` : undefined,
        rango.hasta ? sql`${dia} < ${rango.hasta}::date` : undefined,
        ...extra,
      ),
    )
    .limit(500);
  return filas;
}

/** Condición: el campo está vacío. */
export const vacio = (clave: ClaveCopia, k: string): SQL => sql`coalesce(${registros.campos}->>${campo(clave, k)}, '') in ('', '[]')`;
/** Condición: el campo (una opción) vale exactamente `valor`. */
export const igual = (clave: ClaveCopia, k: string, valor: string): SQL => sql`${registros.campos}->>${campo(clave, k)} = ${valor}`;

/** Valor crudo de un campo de una fila de la copia. */
export const valor = (f: FilaCopia, clave: ClaveCopia, k: string): unknown => f.campos[campo(clave, k)];
/** IDs de un vínculo. */
export const vinculo = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Nombres de unidades de 6. OPERACION 360 (vínculo de RESERVAS y LIMPIEZA). */
export async function nombresOperacion(db: Db, recIds: string[]): Promise<Map<string, string>> {
  if (!recIds.length) return new Map();
  const { idBase, idTabla } = TABLAS.unidadesOperacionCopia;
  const id = campo("unidadesOperacionCopia", "unidad");
  const filas = await db
    .select({ recId: registros.recId, nombre: sql<string>`${registros.campos}->>${id}` })
    .from(registros)
    .where(and(eq(registros.idBase, idBase), eq(registros.idTabla, idTabla), inArray(registros.recId, [...new Set(recIds)])));
  return new Map(filas.map((f) => [f.recId, f.nombre ?? ""]));
}

/** Nombres de unidades de 7. LIVING (vínculo de INGRESOS), desde la proyección `unidades`. */
export async function nombresLiving(db: Db, recIds: string[]): Promise<Map<string, string>> {
  if (!recIds.length) return new Map();
  const filas = await db.select({ recId: unidades.recId, unidad: unidades.unidad }).from(unidades).where(inArray(unidades.recId, [...new Set(recIds)]));
  return new Map(filas.map((f) => [f.recId, f.unidad ?? ""]));
}

const dm = (t: string) => `${Number(t.slice(8, 10))}/${Number(t.slice(5, 7))}/${t.slice(0, 4)}`;

/** Reservas de la próxima semana de las unidades cuyo nombre contiene `q` (búsqueda ⌘K). */
export async function reservasPorUnidad(db: Db, q: string, hoy: string, hasta: string): Promise<{ recId: string; unidad: string; ingreso: string; salida: string }[]> {
  const U = TABLAS.unidadesOperacionCopia;
  const idNombre = campo("unidadesOperacionCopia", "unidad");
  const us = await db
    .select({ recId: registros.recId, nombre: sql<string>`${registros.campos}->>${idNombre}` })
    .from(registros)
    .where(and(eq(registros.idBase, U.idBase), eq(registros.idTabla, U.idTabla), sql`${registros.campos}->>${idNombre} ilike ${`%${q}%`}`))
    .limit(10);
  if (!us.length) return [];
  const nombres = new Map(us.map((u) => [u.recId, u.nombre]));
  const idUnidad = campo("reservasHost", "unidad");
  const ingreso = diaDe(campo("reservasHost", "ingreso"));
  const filas = await filasPorFecha(db, "reservasHost", "salida", { desde: hoy }, [
    sql`${ingreso} < ${hasta}::date`,
    sql`(${registros.campos}->${idUnidad}) ?| ${sql.raw(`array[${us.map((u) => `'${u.recId.replace(/[^A-Za-z0-9]/g, "")}'`).join(",")}]`)}`,
  ]);
  return filas
    .map((f) => {
      const u = vinculo(valor(f, "reservasHost", "unidad")).find((x) => nombres.has(x));
      const ing = String(valor(f, "reservasHost", "ingreso") ?? "").slice(0, 10);
      return { recId: f.recId, unidad: (u && nombres.get(u)) || "Unidad", ingreso: ing ? dm(ing) : "", salida: dm(f.dia), orden: ing };
    })
    .sort((a, b) => a.orden.localeCompare(b.orden))
    .slice(0, 6)
    .map((r) => ({ recId: r.recId, unidad: r.unidad, ingreso: r.ingreso, salida: r.salida }));
}

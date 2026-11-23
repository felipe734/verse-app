import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { usoPantallas, usuarios } from "@/db/esquema";

/** Suma una visita de la persona a esa pantalla hoy. Nunca frena la página. */
export async function registrarUso(db: Db, usuarioId: string, ruta: string, dia: string): Promise<void> {
  await db
    .insert(usoPantallas)
    .values({ usuarioId, ruta: ruta.slice(0, 120), dia })
    .onConflictDoUpdate({ target: [usoPantallas.usuarioId, usoPantallas.ruta, usoPantallas.dia], set: { vistas: sql`${usoPantallas.vistas} + 1` } })
    .catch(() => undefined);
}

/** Uso desde una fecha: por pantalla, con visitas y personas distintas, y por persona. */
export async function usoDesde(db: Db, desde: string) {
  const porPantalla = await db
    .select({ ruta: usoPantallas.ruta, vistas: sql<number>`sum(${usoPantallas.vistas})::int`, personas: sql<number>`count(distinct ${usoPantallas.usuarioId})::int` })
    .from(usoPantallas)
    .where(gte(usoPantallas.dia, desde))
    .groupBy(usoPantallas.ruta)
    .orderBy(desc(sql`sum(${usoPantallas.vistas})`))
    .limit(25);
  const porPersona = await db
    .select({ nombre: usuarios.nombre, correo: usuarios.correo, vistas: sql<number>`sum(${usoPantallas.vistas})::int`, dias: sql<number>`count(distinct ${usoPantallas.dia})::int` })
    .from(usoPantallas)
    .innerJoin(usuarios, eq(usuarios.id, usoPantallas.usuarioId))
    .where(and(gte(usoPantallas.dia, desde)))
    .groupBy(usuarios.nombre, usuarios.correo)
    .orderBy(desc(sql`sum(${usoPantallas.vistas})`));
  return { porPantalla, porPersona };
}

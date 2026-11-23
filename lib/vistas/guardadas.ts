import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { vistasGuardadas } from "@/db/esquema";

export async function vistasDe(db: Db, usuarioId: string, modulo: string) {
  return db
    .select({ id: vistasGuardadas.id, nombre: vistasGuardadas.nombre, parametros: vistasGuardadas.parametros })
    .from(vistasGuardadas)
    .where(and(eq(vistasGuardadas.usuarioId, usuarioId), eq(vistasGuardadas.modulo, modulo)))
    .orderBy(asc(vistasGuardadas.nombre));
}

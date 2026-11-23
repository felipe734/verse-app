import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { accesos, usuarios } from "@/db/esquema";
import { Casillas } from "./casillas";
import type { Sesion } from "./permisos";

/**
 * Arma la sesión desde Postgres en cada petición, así un cambio de casillas o una
 * suspensión aplica en la siguiente acción del usuario.
 */
export async function sesionDe(db: Db, correo: string): Promise<Sesion | null> {
  const [u] = await db.select().from(usuarios).where(eq(sql`lower(${usuarios.correo})`, correo.trim().toLowerCase()));
  if (!u) return null;
  const filas = await db.select().from(accesos).where(eq(accesos.usuarioId, u.id));
  return {
    usuarioId: u.id,
    correo: u.correo,
    estado: u.estado,
    maestro: u.maestro,
    nombreAirtable: u.nombreAirtable,
    accesos: Object.fromEntries(filas.map((a) => [a.empresaId, Casillas.parse(a.casillas)])),
  };
}

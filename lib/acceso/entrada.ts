import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { usuarios } from "@/db/esquema";
import { usarInvitacion } from "./admin";

export type ResultadoEntrada = { ok: true; usuarioId: string } | { ok: false; motivo: "sin-correo" | "no-verificado" | "sin-invitacion" | "invitacion-pendiente" | "suspendido" };

/**
 * Decide si una cuenta de Google puede entrar. Solo usuarios activos de la app:
 * nadie entra por tener una cuenta de Google, hay que estar invitado.
 */
export async function decidirEntrada(
  db: Db,
  correo: string | null | undefined,
  verificado: boolean,
  tokenInvitacion?: string | null,
): Promise<ResultadoEntrada> {
  if (!correo) return { ok: false, motivo: "sin-correo" };
  if (!verificado) return { ok: false, motivo: "no-verificado" };
  const [u] = await db.select().from(usuarios).where(eq(sql`lower(${usuarios.correo})`, correo.trim().toLowerCase()));
  if (!u) return { ok: false, motivo: "sin-invitacion" };
  if (u.estado === "suspendido") return { ok: false, motivo: "suspendido" };
  if (u.estado === "invitado") {
    // El enlace de invitación activa la cuenta si el correo de Google coincide.
    if (!tokenInvitacion || !(await usarInvitacion(db, tokenInvitacion, correo))) return { ok: false, motivo: "invitacion-pendiente" };
  }
  await db.update(usuarios).set({ ultimoIngreso: sql`now()` }).where(eq(usuarios.id, u.id));
  return { ok: true, usuarioId: u.id };
}

export const MENSAJES_ENTRADA: Record<string, string> = {
  "sin-correo": "Google no entregó un correo para esta cuenta.",
  "no-verificado": "El correo de esta cuenta de Google no está verificado.",
  "sin-invitacion": "Esta cuenta no tiene invitación. Pídele acceso a Felipe.",
  "invitacion-pendiente": "Tu invitación está pendiente. Entra con el enlace que te llegó.",
  suspendido: "Tu acceso está suspendido.",
};

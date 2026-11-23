import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { COOKIE_VITRINA, esVitrina, MAESTRO_VITRINA } from "@/lib/vitrina/activa";
import { auth } from "@/auth";
import { db } from "@/db/cliente";
import type { Sesion } from "./permisos";
import { sesionDe } from "./sesion";

/**
 * La sesión de quien hace la petición, armada desde Postgres. Si no entró, si no existe
 * o si está suspendido, va a /entrar. Toda pantalla privada empieza aquí.
 */
export async function sesionActual(): Promise<Sesion> {
  // Todo lo que depende de la sesión se arma en la petición (fechas de Hoy incluidas).
  await connection();
  if (esVitrina()) {
    // Solo Playwright: la cookie elige el usuario de prueba; sin ella, sin sesión (como en producción).
    const correo = (await cookies()).get(COOKIE_VITRINA)?.value;
    if (!correo) redirect("/entrar");
    const vitrina = await sesionDe(db(), correo === "maestro" ? MAESTRO_VITRINA : correo);
    if (!vitrina) redirect("/entrar");
    return vitrina;
  }
  const s = await auth();
  const correo = s?.user?.email;
  if (!correo) redirect("/entrar");
  const sesion = await sesionDe(db(), correo);
  if (!sesion || sesion.estado !== "activo") redirect("/entrar?error=suspendido");
  return sesion;
}

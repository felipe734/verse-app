import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db/cliente";
import type { Sesion } from "./permisos";
import { sesionDe } from "./sesion";

/**
 * La sesión de quien hace la petición, armada desde Postgres. Si no entró, si no existe
 * o si está suspendido, va a /entrar. Toda pantalla privada empieza aquí.
 */
export async function sesionActual(): Promise<Sesion> {
  const s = await auth();
  const correo = s?.user?.email;
  if (!correo) redirect("/entrar");
  const sesion = await sesionDe(db(), correo);
  if (!sesion || sesion.estado !== "activo") redirect("/entrar?error=suspendido");
  return sesion;
}

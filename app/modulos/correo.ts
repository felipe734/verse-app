"use server";

import { sesionActual } from "@/lib/acceso/actual";
import { hiloDe, type MensajeHilo } from "@/lib/correo/bandeja";
import { composioServidor } from "@/lib/servidor/composio";

/** Abre un hilo en el panel de Correo. Revisa el acceso a la cuenta en el servidor. */
export async function leerHilo(cuenta: string, hilo: string): Promise<{ mensajes: MensajeHilo[] } | { error: string }> {
  if (typeof cuenta !== "string" || typeof hilo !== "string") return { error: "Hilo inválido." };
  const cliente = composioServidor();
  if (!cliente) return { error: "El correo no está configurado." };
  try {
    return await hiloDe(cliente, await sesionActual(), cuenta, hilo);
  } catch (e) {
    console.error("[correo/hilo]", e instanceof Error ? e.message : e);
    return { error: "Gmail no respondió. Intenta de nuevo." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { confirmarPropuesta, rechazarPropuesta } from "@/lib/asistente/propuestas";
import { ejecutarCorreo } from "@/lib/correo/enviar";
import type { ResultadoAccion } from "@/lib/hoy/acciones";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";
import { composioServidor } from "@/lib/servidor/composio";

export async function confirmar(id: string): Promise<ResultadoAccion> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, mensaje: "Propuesta inválida" };
  const s = await sesionActual();
  const contador = crearContador();
  try {
    const r = await confirmarPropuesta(db(), clienteServidor(contador), s, id);
    await contador.volcar(db());
    revalidatePath("/hoy");
    return r;
  } catch (e) {
    console.error("[asistente/confirmar]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "No se pudo ejecutar. Intenta de nuevo" };
  }
}

export async function cancelar(id: string): Promise<ResultadoAccion> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, mensaje: "Propuesta inválida" };
  return rechazarPropuesta(db(), await sesionActual(), id);
}

/** Guardar el borrador en Gmail o enviar el correo de una tarjeta, con lo que la persona editó. */
export async function resolverCorreo(id: string, modo: "borrador" | "enviar", edicion: { asunto: string; cuerpo: string }): Promise<ResultadoAccion> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || (modo !== "borrador" && modo !== "enviar")) return { ok: false, mensaje: "Correo inválido" };
  if (typeof edicion?.asunto !== "string" || typeof edicion?.cuerpo !== "string") return { ok: false, mensaje: "Correo inválido" };
  const composio = composioServidor();
  if (!composio) return { ok: false, mensaje: "El correo no está configurado (falta COMPOSIO_API_KEY)" };
  const s = await sesionActual();
  const contador = crearContador();
  try {
    const r = await ejecutarCorreo({ db: db(), composio, airtable: clienteServidor(contador), sesion: s, id, modo, edicion: { asunto: edicion.asunto, cuerpo: edicion.cuerpo } });
    await contador.volcar(db());
    revalidatePath("/hoy");
    return r;
  } catch (e) {
    console.error("[asistente/correo]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: modo === "enviar" ? "Algo falló. Revisa Enviados antes de intentar otra vez" : "No se pudo guardar. Intenta de nuevo" };
  }
}

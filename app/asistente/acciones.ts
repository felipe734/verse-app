"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { confirmarPropuesta, rechazarPropuesta } from "@/lib/asistente/propuestas";
import type { ResultadoAccion } from "@/lib/hoy/acciones";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";

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

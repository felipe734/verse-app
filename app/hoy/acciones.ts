"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { aplicarAccion, type Accion, type ResultadoAccion } from "@/lib/hoy/acciones";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";

const TIPOS = new Set(["cerrar", "aplazar", "descartar", "aprobar", "rechazar"]);

/** Acción de Hoy o Para aprobar desde la pantalla. El permiso se revisa en el servidor. */
export async function accionPendiente(recId: string, accion: Accion): Promise<ResultadoAccion> {
  if (!/^rec[A-Za-z0-9]{14}$/.test(recId) || !TIPOS.has(accion?.tipo)) return { ok: false, mensaje: "Acción inválida" };
  const sesion = await sesionActual();
  const contador = crearContador();
  try {
    const r = await aplicarAccion(db(), clienteServidor(contador), sesion, recId, accion);
    await contador.volcar(db());
    revalidatePath("/hoy");
    revalidatePath("/aprobar");
    return r;
  } catch (e) {
    console.error("[hoy/accion]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "No se pudo guardar. Intenta de nuevo" };
  }
}

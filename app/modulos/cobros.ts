"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { adjuntarSoporte, type Resultado } from "@/lib/cobros/soporte";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";
import { rutaValida, urlDeLectura } from "@/lib/servidor/blob";

/** El comprobante llega como su ruta en el almacén; a Airtable va una URL de lectura firmada. */
export async function adjuntarSoporteAccion(recId: string, archivo: { ruta: string; nombre: string }): Promise<Resultado> {
  const s = await sesionActual();
  if (!archivo || !rutaValida(archivo.ruta, "cobros")) return { ok: false, mensaje: "El soporte no se subió bien. Súbelo otra vez" };
  const contador = crearContador();
  try {
    const url = await urlDeLectura(archivo.ruta);
    const r = await adjuntarSoporte(db(), clienteServidor(contador, { fresco: true }), s, String(recId), { url, nombre: String(archivo.nombre ?? "soporte") });
    await contador.volcar(db());
    if (r.ok) revalidatePath("/verse/living/cobros");
    return r;
  } catch (e) {
    console.error("[cobros/soporte]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "Airtable no respondió. Intenta de nuevo" };
  }
}

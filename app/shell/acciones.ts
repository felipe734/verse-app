"use server";

import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { buscarGlobal, type Resultado } from "@/lib/buscar/global";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";

/** Búsqueda de ⌘K. Sin clave de Airtable (vitrina, CI) no busca reservas. */
export async function buscar(texto: string): Promise<Resultado[]> {
  if (typeof texto !== "string" || texto.length > 80) return [];
  const s = await sesionActual();
  const contador = crearContador();
  try {
    const r = await buscarGlobal(db(), s, texto, process.env.AIRTABLE_TOKEN ? clienteServidor(contador) : undefined);
    await contador.volcar(db());
    return r;
  } catch (e) {
    console.error("[buscar]", e instanceof Error ? e.message : e);
    return [];
  }
}

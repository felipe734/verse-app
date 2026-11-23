"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { crearContador } from "@/lib/medicion/contador";
import { formularioEdicion, guardarEdicion, type Formulario, type Guardado } from "@/lib/modulos/editar";
import { pestanaDe } from "@/lib/modulos/finanzas";
import { ubicar } from "@/lib/modulos/registro";
import { clienteServidor } from "@/lib/servidor/airtable";

export interface RefModulo {
  empresa: string;
  vertical: string;
  modulo: string;
  pestana?: string;
}

/** Del módulo de la URL a su definición de edición, siempre con el acceso de la sesión. */
async function contexto(ref: RefModulo) {
  const s = await sesionActual();
  const u = ubicar(s, s.estructura ?? ESTRUCTURA, String(ref.empresa), String(ref.vertical), String(ref.modulo));
  const tabla = u?.def.tabla ?? (u?.def.pestanas ? pestanaDe(u.def.tipo, ref.pestana)?.tabla : undefined);
  if (!u || !tabla?.editar) return null;
  return { s, u, editar: tabla.editar, ruta: `/${u.empresa}/${u.vertical.segmento}/${u.def.segmento}` };
}

export async function abrirEdicion(ref: RefModulo, recId: string): Promise<Formulario | { error: string }> {
  const c = await contexto(ref);
  if (!c) return { error: "Este módulo no se edita desde la app" };
  const contador = crearContador();
  try {
    const r = await formularioEdicion(clienteServidor(contador), c.s, c.u.empresa, c.u.modulo.id, c.editar, String(recId));
    await contador.volcar(db());
    return r;
  } catch (e) {
    console.error("[editar/abrir]", e instanceof Error ? e.message : e);
    return { error: "Airtable no respondió. Intenta de nuevo" };
  }
}

export async function guardarEdicionAccion(ref: RefModulo, recId: string, cambios: Record<string, string | boolean>, antes: Record<string, unknown>): Promise<Guardado> {
  const c = await contexto(ref);
  if (!c) return { ok: false, mensaje: "Este módulo no se edita desde la app" };
  if (!cambios || typeof cambios !== "object" || !antes || typeof antes !== "object") return { ok: false, mensaje: "Cambios inválidos" };
  const contador = crearContador();
  try {
    const r = await guardarEdicion(db(), clienteServidor(contador), c.s, c.u.empresa, c.u.modulo.id, c.editar, String(recId), cambios, antes);
    await contador.volcar(db());
    if (r.ok) revalidatePath(c.ruta);
    return r;
  } catch (e) {
    console.error("[editar/guardar]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "Airtable no respondió. Intenta de nuevo" };
  }
}

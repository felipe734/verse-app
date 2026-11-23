"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { crearContador } from "@/lib/medicion/contador";
import { formularioEdicion, guardarEdicion, idDeCampo, type Formulario, type Guardado } from "@/lib/modulos/editar";
import { pestanaDe } from "@/lib/modulos/finanzas";
import { leerRelacionados, type BloqueRelacionado } from "@/lib/modulos/relacionados";
import { hoyBogota } from "@/lib/hoy/clasificar";
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

/**
 * Acción de un toque o tarjeta movida en el tablero: un solo campo de opciones. `valorActual`
 * es lo que la persona veía; si Airtable cambió entre tanto, gana Airtable.
 */
export async function cambiarRapido(ref: RefModulo, recId: string, campo: string, valor: string, valorActual: string): Promise<Guardado> {
  const c = await contexto(ref);
  if (!c) return { ok: false, mensaje: "Este módulo no se edita desde la app" };
  const id = idDeCampo(c.editar, String(campo));
  if (!id) return { ok: false, mensaje: "Ese campo no se edita desde la app" };
  const contador = crearContador();
  try {
    const r = await guardarEdicion(db(), clienteServidor(contador), c.s, c.u.empresa, c.u.modulo.id, c.editar, String(recId), { [campo]: String(valor) }, { [id]: valorActual || null });
    await contador.volcar(db());
    if (r.ok) revalidatePath(c.ruta);
    return r;
  } catch (e) {
    console.error("[editar/rapido]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "Airtable no respondió. Intenta de nuevo" };
  }
}

/** Registros relacionados de una fila abierta, con los permisos de la persona. */
export async function relacionadosDe(ref: RefModulo, celdas: Record<string, string>): Promise<BloqueRelacionado[]> {
  const s = await sesionActual();
  const estructura = s.estructura ?? ESTRUCTURA;
  const u = ubicar(s, estructura, String(ref.empresa), String(ref.vertical), String(ref.modulo));
  const relaciones = u?.def.tabla?.relacionados;
  if (!u || !relaciones?.length || !celdas || typeof celdas !== "object") return [];
  const limpias = Object.fromEntries(Object.entries(celdas).filter(([k, v]) => typeof k === "string" && typeof v === "string" && v.length < 300));
  const contador = crearContador();
  try {
    const r = await leerRelacionados(clienteServidor(contador), s, estructura, u.empresa, relaciones, limpias, hoyBogota());
    await contador.volcar(db());
    return r;
  } catch (e) {
    console.error("[relacionados]", e instanceof Error ? e.message : e);
    return [];
  }
}

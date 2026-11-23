"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { crearFila, formularioCreacion, type CampoNuevo } from "@/lib/modulos/crear";
import { pestanaDe } from "@/lib/modulos/finanzas";
import { ubicar } from "@/lib/modulos/registro";
import { clienteServidor } from "@/lib/servidor/airtable";
import { rutaValida, urlDeLectura } from "@/lib/servidor/blob";
import type { RefModulo } from "./editar";

async function contexto(ref: RefModulo) {
  const s = await sesionActual();
  const u = ubicar(s, s.estructura ?? ESTRUCTURA, String(ref.empresa), String(ref.vertical), String(ref.modulo));
  const crear = u?.def.pestanas ? pestanaDe(u.def.tipo, ref.pestana)?.crear : undefined;
  if (!u || !crear) return null;
  return { s, u, crear, ruta: `/${u.empresa}/${u.vertical.segmento}/${u.def.segmento}` };
}

export async function abrirCreacion(ref: RefModulo): Promise<{ campos: CampoNuevo[] } | { error: string }> {
  const c = await contexto(ref);
  if (!c) return { error: "Aquí no se crean registros" };
  const contador = crearContador();
  try {
    const r = await formularioCreacion(clienteServidor(contador), c.s, c.u.empresa, c.u.modulo.id, c.crear, hoyBogota());
    await contador.volcar(db());
    return r;
  } catch (e) {
    console.error("[crear/abrir]", e instanceof Error ? e.message : e);
    return { error: "Airtable no respondió. Intenta de nuevo" };
  }
}

export async function crearAccion(ref: RefModulo, valores: Record<string, unknown>): Promise<{ ok: boolean; mensaje: string }> {
  const c = await contexto(ref);
  if (!c) return { ok: false, mensaje: "Aquí no se crean registros" };
  if (!valores || typeof valores !== "object") return { ok: false, mensaje: "Datos inválidos" };
  const contador = crearContador();
  try {
    // Un archivo llega como su ruta en el almacén; a Airtable va una URL de lectura firmada.
    const datos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valores)) {
      if (v && typeof v === "object" && "ruta" in v) {
        const a = v as { ruta: unknown; nombre?: unknown };
        if (!rutaValida(a.ruta, "soportes")) return { ok: false, mensaje: "El soporte no se subió bien. Súbelo otra vez" };
        datos[k] = { url: await urlDeLectura(a.ruta), nombre: String(a.nombre ?? "soporte") };
      } else datos[k] = v;
    }
    const r = await crearFila(db(), clienteServidor(contador), c.s, c.u.empresa, c.u.modulo.id, c.crear, datos);
    await contador.volcar(db());
    if (r.ok) revalidatePath(c.ruta);
    return r;
  } catch (e) {
    console.error("[crear/guardar]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "Airtable no respondió. Intenta de nuevo" };
  }
}

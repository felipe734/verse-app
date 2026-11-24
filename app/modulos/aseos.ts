"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { cambiarAseo, programacion, programarAseo, puedeProgramar, type Programacion, type Resultado } from "@/lib/aseos/programacion";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";

const RUTA = "/verse/host/limpiezas";

async function conCliente<T>(f: (a: ReturnType<typeof clienteServidor>) => Promise<T>): Promise<T> {
  const contador = crearContador();
  const r = await f(clienteServidor(contador, { fresco: true }));
  await contador.volcar(db());
  return r;
}

const fallo = (e: unknown): Resultado => {
  console.error("[aseos]", e instanceof Error ? e.message : e);
  return { ok: false, mensaje: "Airtable no respondió. Intenta de nuevo" };
};

export async function leerProgramacion(): Promise<Programacion | { error: string }> {
  const s = await sesionActual();
  if (!puedeProgramar(s)) return { error: "No puedes programar aseos" };
  try {
    return await conCliente((a) => programacion(a, hoyBogota()));
  } catch (e) {
    return { error: fallo(e).mensaje };
  }
}

const Nuevo = z.object({ unidad: z.string(), fecha: z.string(), hora: z.string(), funcionaria: z.string().optional(), comentario: z.string().max(2000).optional() });
const Cambio = z.object({ recId: z.string(), funcionaria: z.string().optional(), fecha: z.string().optional(), hora: z.string().optional() });

export async function programarAccion(datos: unknown): Promise<Resultado> {
  const s = await sesionActual();
  const d = Nuevo.safeParse(datos);
  if (!d.success) return { ok: false, mensaje: "Datos inválidos" };
  try {
    const r = await conCliente((a) => programarAseo(db(), a, s, { ...d.data, funcionaria: d.data.funcionaria || undefined }));
    if (r.ok) revalidatePath(RUTA);
    return r;
  } catch (e) {
    return fallo(e);
  }
}

export async function cambiarAccion(datos: unknown): Promise<Resultado> {
  const s = await sesionActual();
  const d = Cambio.safeParse(datos);
  if (!d.success) return { ok: false, mensaje: "Datos inválidos" };
  try {
    const r = await conCliente((a) => cambiarAseo(db(), a, s, d.data));
    if (r.ok) revalidatePath(RUTA);
    return r;
  } catch (e) {
    return fallo(e);
  }
}

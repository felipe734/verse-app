"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { cerrarOlvidado, validarSemana, type Resultado } from "@/lib/horas/semana";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";

const RUTA = "/verse/general/equipo";

async function conCliente<T>(f: (a: ReturnType<typeof clienteServidor>) => Promise<T>): Promise<T> {
  const contador = crearContador();
  const r = await f(clienteServidor(contador, { fresco: true }));
  await contador.volcar(db());
  return r;
}

const fallo = (e: unknown): Resultado => {
  console.error("[horas]", e instanceof Error ? e.message : e);
  return { ok: false, mensaje: "Airtable no respondió. Intenta de nuevo" };
};

export async function cerrarOlvidadoAccion(recId: string, hora: string): Promise<Resultado> {
  const s = await sesionActual();
  try {
    const r = await conCliente((a) => cerrarOlvidado(db(), a, s, String(recId), String(hora)));
    if (r.ok) revalidatePath(RUTA);
    return r;
  } catch (e) {
    return fallo(e);
  }
}

export async function validarSemanaAccion(nombre: string, lunes: string): Promise<Resultado> {
  const s = await sesionActual();
  try {
    const r = await conCliente((a) => validarSemana(db(), a, s, String(nombre), String(lunes), hoyBogota()));
    if (r.ok) revalidatePath(RUTA);
    return r;
  } catch (e) {
    return fallo(e);
  }
}

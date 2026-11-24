"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";
import { crearTicket, puedeTickets, unidadesActivas, type Resultado } from "@/lib/tickets/tickets";

const RUTA = "/verse/host/tickets";

async function conCliente<T>(f: (a: ReturnType<typeof clienteServidor>) => Promise<T>): Promise<T> {
  const contador = crearContador();
  const r = await f(clienteServidor(contador));
  await contador.volcar(db());
  return r;
}

export async function unidadesParaTicket(): Promise<{ recId: string; nombre: string }[] | { error: string }> {
  const s = await sesionActual();
  if (!puedeTickets(s)) return { error: "No puedes abrir tickets" };
  try {
    return await conCliente((a) => unidadesActivas(a));
  } catch (e) {
    console.error("[tickets/unidades]", e instanceof Error ? e.message : e);
    return { error: "Airtable no respondió. Intenta de nuevo" };
  }
}

const Nuevo = z.object({
  titulo: z.string(),
  unidad: z.string().optional(),
  tipo: z.string(),
  prioridad: z.string(),
  responsable: z.string().optional(),
  fechaLimite: z.string().optional(),
  comentario: z.string().optional(),
});

export async function crearTicketAccion(datos: unknown): Promise<Resultado> {
  const s = await sesionActual();
  const d = Nuevo.safeParse(datos);
  if (!d.success) return { ok: false, mensaje: "Datos inválidos" };
  try {
    const r = await conCliente((a) => crearTicket(db(), a, s, { ...d.data, unidad: d.data.unidad || undefined, fechaLimite: d.data.fechaLimite || undefined }, hoyBogota()));
    if (r.ok) revalidatePath(RUTA);
    return r;
  } catch (e) {
    console.error("[tickets/crear]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "Airtable no respondió. Intenta de nuevo" };
  }
}

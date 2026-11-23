"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { cerrarTurno, datosIngreso, iniciarTurno, reportar, type DatosIngreso, type Resultado } from "@/lib/ruta/ruta";
import { clienteServidor } from "@/lib/servidor/airtable";

const RUTA = "/verse/host/ruta";

async function conCliente<T>(f: (a: ReturnType<typeof clienteServidor>) => Promise<T>): Promise<T> {
  const contador = crearContador();
  const r = await f(clienteServidor(contador));
  await contador.volcar(db());
  return r;
}

const fallo = (e: unknown): Resultado => {
  console.error("[ruta]", e instanceof Error ? e.message : e);
  return { ok: false, mensaje: "Airtable no respondió. Intenta de nuevo" };
};

export async function iniciarTurnoAccion(): Promise<Resultado> {
  const s = await sesionActual();
  try {
    const r = await conCliente((a) => iniciarTurno(db(), a, s, hoyBogota()));
    revalidatePath(RUTA);
    return r;
  } catch (e) {
    return fallo(e);
  }
}

export async function cerrarTurnoAccion(): Promise<Resultado> {
  const s = await sesionActual();
  try {
    const r = await conCliente((a) => cerrarTurno(db(), a, s, hoyBogota()));
    revalidatePath(RUTA);
    return r;
  } catch (e) {
    return fallo(e);
  }
}

export async function datosIngresoAccion(limpieza: string): Promise<DatosIngreso | { error: string }> {
  if (!/^rec[A-Za-z0-9]{14}$/.test(String(limpieza))) return { error: "Limpieza inválida" };
  const s = await sesionActual();
  try {
    return await conCliente((a) => datosIngreso(db(), a, s, hoyBogota(), limpieza));
  } catch (e) {
    return { error: fallo(e).mensaje };
  }
}

const ReporteEntrada = z.object({
  limpieza: z.string().regex(/^rec[A-Za-z0-9]{14}$/),
  tipo: z.enum(["Inventario de Entrega", "Inventario de Recibido"]),
  estado: z.enum(["Listo para entregar", "Actividades pendientes"]),
  danos: z.string().max(2000).optional(),
  comentario: z.string().max(2000).optional(),
  necesitaImplementos: z.boolean(),
  implementos: z.string().max(1000).optional(),
  lavanderia: z.string().max(1000).optional(),
  video: z.object({ url: z.string().url().startsWith("https://"), nombre: z.string().max(200) }).optional(),
});

export async function reportarAccion(entrada: unknown): Promise<Resultado> {
  const r = ReporteEntrada.safeParse(entrada);
  if (!r.success) return { ok: false, mensaje: "Revisa el reporte" };
  // El video solo puede venir del almacenamiento de la app.
  if (r.data.video && !new URL(r.data.video.url).hostname.endsWith(".public.blob.vercel-storage.com")) return { ok: false, mensaje: "El video no se subió bien. Súbelo otra vez" };
  const s = await sesionActual();
  try {
    const res = await conCliente((a) => reportar(db(), a, s, hoyBogota(), r.data));
    revalidatePath(RUTA);
    return res;
  } catch (e) {
    return fallo(e);
  }
}

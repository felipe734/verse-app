"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { cerrarTurno, datosIngreso, iniciarTurno, reportar, type DatosIngreso, type Resultado } from "@/lib/ruta/ruta";
import { clienteServidor } from "@/lib/servidor/airtable";
import { rutaValida, urlDeLectura } from "@/lib/servidor/blob";

const RUTA = "/verse/host/ruta";

async function conCliente<T>(f: (a: ReturnType<typeof clienteServidor>) => Promise<T>): Promise<T> {
  const contador = crearContador();
  const r = await f(clienteServidor(contador, { fresco: true }));
  await contador.volcar(db());
  return r;
}

/** Hora real del toque cuando se envía sin señal: no futura ni de más de 12 horas atrás. */
function horaDelToque(cuando: unknown): Date | undefined {
  if (typeof cuando !== "string") return undefined;
  const d = new Date(cuando);
  const ahora = Date.now();
  if (Number.isNaN(d.getTime()) || d.getTime() > ahora + 2 * 60_000 || d.getTime() < ahora - 12 * 3_600_000) return undefined;
  return d;
}

const fallo = (e: unknown): Resultado => {
  console.error("[ruta]", e instanceof Error ? e.message : e);
  return { ok: false, mensaje: "Airtable no respondió. Intenta de nuevo" };
};

export async function iniciarTurnoAccion(cuando?: string): Promise<Resultado> {
  const s = await sesionActual();
  try {
    const t = horaDelToque(cuando);
    const r = await conCliente((a) => iniciarTurno(db(), a, s, hoyBogota(t), t));
    revalidatePath(RUTA);
    return r;
  } catch (e) {
    return fallo(e);
  }
}

export async function cerrarTurnoAccion(cuando?: string): Promise<Resultado> {
  const s = await sesionActual();
  try {
    const t = horaDelToque(cuando);
    const r = await conCliente((a) => cerrarTurno(db(), a, s, hoyBogota(t), t));
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
  video: z.object({ ruta: z.string().max(400), nombre: z.string().max(200) }).optional(),
});

export async function reportarAccion(entrada: unknown, cuando?: string): Promise<Resultado> {
  const r = ReporteEntrada.safeParse(entrada);
  if (!r.success) return { ok: false, mensaje: "Revisa el reporte" };
  // El video solo puede venir del almacenamiento de la app, en su carpeta.
  if (r.data.video && !rutaValida(r.data.video.ruta, "servicios")) return { ok: false, mensaje: "El video no se subió bien. Súbelo otra vez" };
  const s = await sesionActual();
  try {
    const video = r.data.video ? { url: await urlDeLectura(r.data.video.ruta), nombre: r.data.video.nombre } : undefined;
    const t = horaDelToque(cuando);
    const res = await conCliente((a) => reportar(db(), a, s, hoyBogota(t), { ...r.data, video }, t));
    revalidatePath(RUTA);
    return res;
  } catch (e) {
    return fallo(e);
  }
}

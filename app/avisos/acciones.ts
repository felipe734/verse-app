"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/cliente";
import { suscripcionesPush } from "@/db/esquema";
import { sesionActual } from "@/lib/acceso/actual";
import { auditar } from "@/lib/auditoria";

const Sub = z.object({
  endpoint: z.string().url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

/** Guarda el dispositivo donde la persona activó los avisos. */
export async function guardarSuscripcion(datos: unknown): Promise<{ ok: boolean; mensaje: string }> {
  const s = await sesionActual();
  const r = Sub.safeParse(datos);
  if (!r.success) return { ok: false, mensaje: "El navegador no entregó una suscripción válida" };
  const { endpoint, keys } = r.data;
  await db()
    .insert(suscripcionesPush)
    .values({ usuarioId: s.usuarioId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({ target: suscripcionesPush.endpoint, set: { usuarioId: s.usuarioId, p256dh: keys.p256dh, auth: keys.auth, activa: true } });
  await auditar(db(), { autor: s.correo, accion: "avisos.activados" });
  return { ok: true, mensaje: "Avisos activados en este dispositivo" };
}

export async function quitarSuscripcion(endpoint: string): Promise<{ ok: boolean; mensaje: string }> {
  const s = await sesionActual();
  await db()
    .update(suscripcionesPush)
    .set({ activa: false })
    .where(and(eq(suscripcionesPush.endpoint, endpoint), eq(suscripcionesPush.usuarioId, s.usuarioId)));
  await auditar(db(), { autor: s.correo, accion: "avisos.desactivados" });
  return { ok: true, mensaje: "Avisos desactivados en este dispositivo" };
}

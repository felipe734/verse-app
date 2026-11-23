"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/cliente";
import { vistasGuardadas } from "@/db/esquema";
import { sesionActual } from "@/lib/acceso/actual";

const RUTA = /^\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/;

/** Guarda los filtros y la vista actual con un nombre. El período no se guarda: siempre abre en lo actual. */
export async function guardarVista(modulo: string, nombre: string, parametros: Record<string, string>): Promise<{ ok: boolean; mensaje: string }> {
  const s = await sesionActual();
  const n = String(nombre ?? "").trim().slice(0, 60);
  if (!RUTA.test(String(modulo)) || !n) return { ok: false, mensaje: "Nombre inválido" };
  const limpios = Object.fromEntries(
    Object.entries(parametros ?? {})
      .filter(([k, v]) => k !== "p" && typeof v === "string" && k.length < 80 && v.length < 200)
      .slice(0, 20),
  );
  await db()
    .insert(vistasGuardadas)
    .values({ usuarioId: s.usuarioId, modulo, nombre: n, parametros: limpios })
    .onConflictDoUpdate({ target: [vistasGuardadas.usuarioId, vistasGuardadas.modulo, vistasGuardadas.nombre], set: { parametros: limpios } });
  return { ok: true, mensaje: "Guardada" };
}

export async function borrarVista(id: string): Promise<void> {
  const s = await sesionActual();
  if (!/^[0-9a-f-]{36}$/.test(String(id))) return;
  await db().delete(vistasGuardadas).where(and(eq(vistasGuardadas.id, id), eq(vistasGuardadas.usuarioId, s.usuarioId)));
}

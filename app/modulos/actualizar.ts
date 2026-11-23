"use server";

import { sesionActual } from "@/lib/acceso/actual";
import { vencerTabla } from "@/lib/servidor/cache-airtable";

/** "Actualizar": vence la caché de las tablas del módulo para traer lo último de Airtable. */
export async function actualizarTablas(idTablas: string[]): Promise<void> {
  await sesionActual();
  for (const id of (idTablas ?? []).slice(0, 5)) if (/^tbl[A-Za-z0-9]{14}$/.test(String(id))) vencerTabla(id);
}

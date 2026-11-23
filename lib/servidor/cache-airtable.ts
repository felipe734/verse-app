import { cacheLife, cacheTag } from "next/cache";
import { revalidateTag, updateTag } from "next/cache";
import { db } from "@/db/cliente";
import { crearCliente, type RegistroAirtable } from "@/lib/airtable/cliente";
import { exigir, leerEntorno } from "@/lib/entorno";
import { crearContador } from "@/lib/medicion/contador";

/**
 * Caché de lecturas de Airtable: 60 segundos por consulta exacta (tabla, fórmula, campos y
 * orden). Como cada nivel de acceso pide campos distintos, nadie recibe de la caché un campo
 * que su casilla no abre. Solo las lecturas que de verdad llegan a Airtable se cuentan.
 */
export const etiquetaTabla = (idTabla: string) => `airtable:${idTabla}`;

export interface Lectura {
  filas: RegistroAirtable[];
  /** ISO de cuándo se leyó de Airtable. */
  leido: string;
}

export async function consultarCacheado(idBase: string, idTabla: string, opciones: { formula?: string; campos: string[]; max: number; orden?: { campo: string; desc?: boolean } }): Promise<Lectura> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 600 });
  cacheTag(etiquetaTabla(idTabla));
  const contador = crearContador();
  const cliente = crearCliente({ token: exigir(leerEntorno(), "AIRTABLE_TOKEN"), alLlamar: contador.contar });
  const filas = await cliente.consultar(idBase, idTabla, opciones);
  await contador.volcar(db()).catch(() => undefined);
  return { filas, leido: new Date().toISOString() };
}

/**
 * Después de escribir en una tabla, su caché se vence. En una acción del servidor la persona ve
 * su cambio de inmediato (updateTag); en un cron, la próxima lectura trae lo nuevo.
 */
export function vencerTabla(idTabla: string) {
  try {
    updateTag(etiquetaTabla(idTabla));
  } catch {
    try {
      revalidateTag(etiquetaTabla(idTabla), "max");
    } catch {
      /* fuera de Next (pruebas): no hay caché que vencer */
    }
  }
}

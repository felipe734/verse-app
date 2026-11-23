import type { FilaCatalogo } from "@/lib/airtable/construir-mapeo";
import { estaEnLaApp } from "@/lib/airtable/definicion";

/**
 * Tablas a respaldar en una fecha: las del catálogo dentro de la app (decisión de Felipe,
 * 2026-11-22: FELIPE, 5. VENTAS 54-47 y 6. OTROS quedan fuera). Las Histórica solo el día 1.
 */
export function tablasDelDia(catalogo: readonly FilaCatalogo[], fecha: string): FilaCatalogo[] {
  const diaUno = fecha.endsWith("-01");
  return catalogo.filter((f) => estaEnLaApp(f.base) && (f.uso !== "Histórica" || diaUno));
}

/** Nombre de carpeta seguro para Drive. */
export function nombreCarpeta(s: string): string {
  return s.replace(/[\\/]/g, "-").trim();
}

/**
 * Qué carpetas de fechas se conservan: las 30 más recientes y el día 1 de los 12 meses más recientes.
 * Devuelve las que van a la papelera.
 */
export function carpetasAVencer(fechas: string[]): string[] {
  const validas = fechas.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)).sort().reverse();
  const diarias = new Set(validas.slice(0, 30));
  const mensuales = new Set(validas.filter((f) => f.endsWith("-01")).slice(0, 12));
  return validas.filter((f) => !diarias.has(f) && !mensuales.has(f));
}

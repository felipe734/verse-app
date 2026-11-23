/**
 * Reglas de Hoy, las mismas del brief y de verse-trazabilidad:
 * - Crítico: Pendiente abierto cuyo Detalle empieza por "Crítico: ".
 * - Para aprobar: Detalle que empieza por "Aprobar: " (va en su propio módulo, no en Hoy).
 * - Plazo: Vencido, Hoy, Esta semana o Más adelante según la Fecha límite en Bogotá.
 *   Se calcula aquí y no se lee del campo fórmula Plazo, que Airtable recalcula sin avisar.
 * - "En espera" vuelve a salir el día de su Fecha límite.
 * - Antigüedad: días desde la Fecha límite; 3+ urgente, 7+ atascado, 14+ escalado.
 */

export type Seccion = "critico" | "vencido" | "hoy" | "semana";

export const SECCIONES: { id: Seccion; titulo: string }[] = [
  { id: "critico", titulo: "Crítico" },
  { id: "vencido", titulo: "Vencido" },
  { id: "hoy", titulo: "Hoy" },
  { id: "semana", titulo: "Esta semana" },
];

export interface TareaHoy {
  recId: string;
  empresa: "Verse" | "C&C";
  numero: number | null;
  tipo: string | null;
  asunto: string | null;
  proceso: string | null;
  estado: string | null;
  responsable: string | null;
  fechaLimite: string | null;
  detalle: string | null;
  link: string | null;
  linea: string | null;
  corrida: string[];
}

const ABIERTOS = new Set(["Abierto", "En espera"]);

export const esCritico = (t: Pick<TareaHoy, "detalle">) => (t.detalle ?? "").trimStart().startsWith("Crítico:");
export const esAprobar = (t: Pick<TareaHoy, "detalle">) => (t.detalle ?? "").trimStart().startsWith("Aprobar:");

/** Día de hoy en Bogotá, AAAA-MM-DD. */
export function hoyBogota(ahora = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Domingo de la semana de `fecha` (semana de lunes a domingo). */
export function finDeSemana(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay(); // 0 domingo
  return sumarDias(fecha, dia === 0 ? 0 : 7 - dia);
}

export function diasDeAtraso(t: Pick<TareaHoy, "fechaLimite">, hoy: string): number {
  if (!t.fechaLimite || t.fechaLimite >= hoy) return 0;
  return Math.round((new Date(`${hoy}T12:00:00Z`).getTime() - new Date(`${t.fechaLimite}T12:00:00Z`).getTime()) / 86_400_000);
}

export function etiquetaAtraso(dias: number): string | null {
  if (dias >= 14) return "Escalado";
  if (dias >= 7) return "Atascado";
  if (dias >= 3) return "Urgente";
  return null;
}

/** Sección de Hoy de una tarea, o null si no sale hoy (cerrada, para aprobar, más adelante). */
export function seccionDe(t: TareaHoy, hoy: string): Seccion | null {
  if (t.tipo !== "Pendiente" || !ABIERTOS.has(t.estado ?? "")) return null;
  if (esAprobar(t)) return null;
  // Sin fecha: la regla de oro dice que el plazo por defecto es hoy.
  const fecha = t.fechaLimite ?? hoy;
  if (t.estado === "En espera" && fecha > hoy) return null;
  if (esCritico(t)) return "critico";
  if (fecha < hoy) return "vencido";
  if (fecha === hoy) return "hoy";
  if (fecha <= finDeSemana(hoy)) return "semana";
  return null;
}

/** Primera línea del Detalle, sin la etiqueta "Crítico: ". */
export function accion(t: Pick<TareaHoy, "detalle">): string {
  const primera = (t.detalle ?? "").split("\n")[0]?.trim() ?? "";
  return primera.replace(/^Crítico:\s*/, "");
}

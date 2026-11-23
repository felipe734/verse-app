/** Fechas de Hoy en AAAA-MM-DD (Bogotá), sin depender de la zona del navegador. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Próximo lunes (si hoy es lunes, el de la otra semana). */
export function lunes(hoy: string): string {
  const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay();
  return sumarDias(hoy, (8 - dia) % 7 || 7);
}

export const fechaCorta = (f: string | null) =>
  f ? new Date(`${f}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }) : "Sin fecha";

export const fechaLarga = (f: string | null) =>
  f ? new Date(`${f}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "Sin fecha";

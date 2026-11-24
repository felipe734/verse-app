/**
 * El día de un campo de fecha en una fórmula de Airtable, como número AAAAMMDD de Bogotá.
 *
 * Un campo de solo fecha ("2026-11-24") Airtable lo trata como medianoche UTC: con
 * SET_TIMEZONE a Bogotá cae a las 7 p. m. del día anterior y la fecha se corre un día. Por eso:
 * - "fecha" (solo fecha): el día tal cual, sin zona.
 * - "fechaHora": el día en Bogotá.
 * - sin tipo (filtros de período de cualquier módulo): si la hora UTC es 00:00:00 se toma como
 *   solo fecha; si no, en Bogotá. Solo falla con una fecha y hora de exactamente las 7:00:00 p. m.
 *   de Bogotá, que se contaría al día siguiente.
 * Se compara como número: las comparaciones de texto en Airtable no son confiables.
 */
export type TipoFecha = "fecha" | "fechaHora";

export function diaAirtable(campo: string, tipo?: TipoFecha): string {
  const f = `{${campo}}`;
  const local = `DATETIME_FORMAT(SET_TIMEZONE(${f}, 'America/Bogota'), 'YYYYMMDD')`;
  const tal = `DATETIME_FORMAT(${f}, 'YYYYMMDD')`;
  if (tipo === "fecha") return `VALUE(${tal})`;
  if (tipo === "fechaHora") return `VALUE(${local})`;
  return `VALUE(IF(DATETIME_FORMAT(${f}, 'HH:mm:ss') = '00:00:00', ${tal}, ${local}))`;
}

/** "2026-11-24" → 20261124, para comparar con diaAirtable. */
export const numeroDia = (t: string) => t.replaceAll("-", "");

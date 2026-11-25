import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { diaAirtable } from "@/lib/airtable/formulas";
import { leerFecha } from "@/lib/vistas/fechas";

/**
 * Tendencia del año corrido (rediseño R6): suma por mes de una o dos columnas de dinero, para
 * ver cómo va la facturación sin cambiar de mes. Se lee solo cuando el módulo la define.
 */
export interface DefTendencia {
  /** Campo de fecha que ubica la fila en su mes. */
  fecha: string;
  series: { campo: string; etiqueta: string }[];
}

export interface Tendencia {
  anio: string;
  meses: { mes: string; valores: number[] }[];
  etiquetas: string[];
}

export const numero = (v: unknown): number => {
  const t = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  // El separador que va de último con 1 o 2 dígitos después es el decimal; el otro, de miles.
  const ultimo = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  const decimales = ultimo >= 0 ? t.length - ultimo - 1 : 0;
  const entero = decimales > 0 && decimales <= 2 ? t.slice(0, ultimo) : t;
  const dec = decimales > 0 && decimales <= 2 ? t.slice(ultimo + 1) : "";
  const n = Number(`${entero.replace(/[,.]/g, "")}${dec ? `.${dec}` : ""}`);
  return Number.isFinite(n) ? n : 0;
};

export function agrupar(filas: { fields: Record<string, unknown> }[], def: DefTendencia, anio: string): Tendencia {
  const meses = Array.from({ length: 12 }, (_, i) => ({ mes: `${anio}-${String(i + 1).padStart(2, "0")}`, valores: def.series.map(() => 0) }));
  for (const f of filas) {
    const d = leerFecha(String(f.fields[def.fecha] ?? ""))?.fecha;
    if (!d || !d.startsWith(anio)) continue;
    const m = meses[Number(d.slice(5, 7)) - 1]!;
    def.series.forEach((s, i) => (m.valores[i]! += numero(f.fields[s.campo])));
  }
  return { anio, meses, etiquetas: def.series.map((s) => s.etiqueta) };
}

export async function leerTendencia(airtable: ClienteAirtable, idBase: string, idTabla: string, def: DefTendencia, hoy: string): Promise<Tendencia> {
  const anio = hoy.slice(0, 4);
  const filas = await airtable.consultar(idBase, idTabla, {
    campos: [def.fecha, ...def.series.map((s) => s.campo)],
    formula: `AND({${def.fecha}}, ${diaAirtable(def.fecha)} >= ${anio}0101, ${diaAirtable(def.fecha)} < ${Number(anio) + 1}0101)`,
    max: 5000,
  });
  return agrupar(filas, def, anio);
}

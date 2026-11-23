import type { Columna, FilaTabla, Indicador } from "./tabla";

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** "$1.250.000", "12,5" o "8" → número. */
export const aNumero = (v: string) => {
  const limpio = v.replace(/[^\d,-]/g, "").replace(",", ".");
  const n = Number(limpio);
  return limpio && !Number.isNaN(n) ? n : 0;
};

/**
 * Cifras de un módulo sobre unas filas. Una suma de una columna que la persona no ve (montos sin
 * la casilla de cifras) no aparece: la columna ni siquiera se pidió a Airtable.
 */
export function calcularIndicadores(indicadores: Indicador[], columnas: Columna[], filas: FilaTabla[]): { etiqueta: string; valor: string }[] {
  return indicadores
    .map((i) => {
      if (i.tipo === "conteo") {
        const n = i.donde ? filas.filter((f) => i.donde!.valores.includes(f.celdas[i.donde!.campo] ?? "")).length : filas.length;
        return { etiqueta: i.etiqueta, valor: numero.format(n) };
      }
      const col = columnas.find((c) => c.campo === i.campo);
      if (!col) return null;
      if (i.tipo === "distintos") return { etiqueta: i.etiqueta, valor: numero.format(new Set(filas.map((f) => f.celdas[i.campo]).filter(Boolean)).size) };
      const base = i.donde ? filas.filter((f) => i.donde!.valores.includes(f.celdas[i.donde!.campo] ?? "")) : filas;
      const total = base.reduce((s, f) => s + aNumero(f.celdas[i.campo] ?? ""), 0);
      return { etiqueta: i.etiqueta, valor: col.tipo === "dinero" ? pesos.format(total) : numero.format(total) };
    })
    .filter((x): x is { etiqueta: string; valor: string } => Boolean(x));
}

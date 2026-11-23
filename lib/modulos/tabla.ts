import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { sensibles, type Sesion } from "@/lib/acceso/permisos";

/**
 * Módulo de tabla: una lista densa sobre una tabla de Airtable, leída en el momento y solo
 * con los campos que la persona puede ver. Montos (cifras), datos de terceros y códigos se
 * quedan en Airtable si su casilla no los abre: ni siquiera se piden.
 */

export type Sensible = "cifras" | "terceros" | "codigos";

export interface Columna {
  campo: string;
  etiqueta?: string;
  sensible?: Sensible;
  /** Alineación y ancho: los montos y números van a la derecha. */
  tipo?: "texto" | "numero" | "dinero" | "fecha" | "estado";
}

export interface DefTabla {
  idBase: string;
  idTabla: string;
  /** Campo que nombra la fila. */
  titulo: string;
  columnas: Columna[];
  /** Campos extra que solo salen en el detalle. */
  detalle?: Columna[];
  /** Fórmula de Airtable para acotar (por ejemplo, el período). Recibe hoy AAAA-MM-DD. */
  formula?: (hoy: string) => string;
  /** Orden que aplica Airtable (por defecto, de más reciente a más antiguo). */
  orden?: { campo: string; desc?: boolean };
  max?: number;
  /** Texto del estado vacío. */
  vacio?: string;
}

export interface FilaTabla {
  id: string;
  celdas: Record<string, string>;
}

export interface ResultadoTabla {
  columnas: Columna[];
  detalle: Columna[];
  filas: FilaTabla[];
  ocultos: string[];
}

const NOMBRE_OCULTO: Record<Sensible, string> = { cifras: "montos", terceros: "datos de terceros", codigos: "códigos" };

/** Columnas que la sesión puede ver en esa vertical. "Solo en su turno" no abre códigos en una lista. */
export function columnasPermitidas(s: Sesion, empresa: string, vertical: string, cols: Columna[]): { visibles: Columna[]; ocultos: string[] } {
  const sens = sensibles(s, empresa, vertical);
  const abre = (x?: Sensible) => !x || (x === "cifras" ? sens.cifras : x === "terceros" ? sens.terceros : sens.codigos === "siempre");
  const visibles = cols.filter((c) => abre(c.sensible));
  const ocultos = [...new Set(cols.filter((c) => !abre(c.sensible)).map((c) => NOMBRE_OCULTO[c.sensible!]))];
  return { visibles, ocultos };
}

const texto = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(texto).filter(Boolean).join(", ");
  if (typeof v === "object") return "name" in (v as object) ? String((v as { name: unknown }).name) : "";
  return String(v);
};

export async function leerTabla(airtable: ClienteAirtable, s: Sesion, empresa: string, vertical: string, def: DefTabla, hoy: string): Promise<ResultadoTabla> {
  const lista = columnasPermitidas(s, empresa, vertical, [{ campo: def.titulo }, ...def.columnas.filter((c) => c.campo !== def.titulo)]);
  const det = columnasPermitidas(s, empresa, vertical, def.detalle ?? []);
  const campos = [...new Set([...lista.visibles, ...det.visibles].map((c) => c.campo))];
  // El orden lo hace Airtable: con cellFormat string las fechas vienen como texto (D/M/AAAA).
  const registros = await airtable.consultar(def.idBase, def.idTabla, {
    campos,
    formula: def.formula?.(hoy),
    max: def.max ?? 200,
    orden: def.orden ? { campo: def.orden.campo, desc: def.orden.desc ?? true } : undefined,
  });
  const filas = registros.map((r) => ({ id: r.id, celdas: Object.fromEntries(campos.map((c) => [c, texto(r.fields[c])])) }));
  return {
    columnas: def.columnas.filter((c) => lista.visibles.some((v) => v.campo === c.campo)),
    detalle: det.visibles,
    filas,
    ocultos: [...new Set([...lista.ocultos, ...det.ocultos])],
  };
}

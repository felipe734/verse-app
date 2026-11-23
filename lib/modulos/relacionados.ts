import type { ClienteAirtable } from "@/lib/airtable/cliente";
import type { EmpresaBase } from "@/lib/acceso/estructura";
import { puede, type Sesion } from "@/lib/acceso/permisos";
import { REGISTRO, segmentoVertical } from "./registro";
import { leerTabla, type Columna } from "./tabla";

/**
 * Registros relacionados en el detalle: una reserva muestra las limpiezas de su unidad, un
 * contrato sus cobros, un acta sus pagos. Cada bloque es otro módulo leído con los permisos de
 * la persona: si no ve ese módulo, el bloque no aparece; si no tiene cifras, no ve montos.
 */
export interface Relacion {
  titulo: string;
  /** Tipo del módulo relacionado en el registro. */
  tipo: string;
  /** Campo del módulo relacionado que se compara. */
  campo: string;
  /** Columna de la fila abierta con el valor a buscar. */
  columna: string;
  max?: number;
}

export interface BloqueRelacionado {
  titulo: string;
  href: string;
  columnas: Columna[];
  filas: { id: string; celdas: Record<string, string> }[];
}

const literal = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export async function leerRelacionados(
  airtable: ClienteAirtable,
  s: Sesion,
  estructura: EmpresaBase[],
  empresa: string,
  relaciones: Relacion[],
  celdas: Record<string, string>,
  hoy: string,
): Promise<BloqueRelacionado[]> {
  const e = estructura.find((x) => x.id === empresa);
  if (!e) return [];
  const bloques = await Promise.all(
    relaciones.map(async (r): Promise<BloqueRelacionado | null> => {
      const valor = (celdas[r.columna] ?? "").split(",")[0]!.trim();
      const def = REGISTRO.find((d) => d.tipo === r.tipo);
      const tabla = def?.tabla;
      if (!valor || !def || !tabla) return null;
      const lugar = e.verticales.flatMap((v) => v.modulos.map((m) => ({ v, m }))).find((x) => x.m.tipo === r.tipo);
      if (!lugar || !puede(s, empresa, lugar.m.id, "ver")) return null;
      // Por texto: sirve para campos de texto y para enlaces (que Airtable devuelve como nombres).
      const formula = `FIND('${literal(valor)}', ARRAYJOIN({${r.campo}}))`;
      const res = await leerTabla(airtable, s, empresa, lugar.v.id, { ...tabla, periodo: undefined, formula: () => formula, max: r.max ?? 8 }, hoy);
      return {
        titulo: r.titulo,
        href: `/${empresa}/${segmentoVertical(empresa, lugar.v.id)}/${def.segmento}`,
        columnas: res.columnas.slice(0, 4),
        filas: res.filas,
      };
    }),
  );
  return bloques.filter((b): b is BloqueRelacionado => Boolean(b));
}

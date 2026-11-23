/**
 * Precios por millón de tokens (US$), de la referencia oficial de la API de Claude.
 * El doc del plan fija claude-sonnet-5-5 por defecto y claude-opus-5-5 para cierres y diagnósticos.
 */
export const MODELO_POR_DEFECTO = "claude-sonnet-5-5";
export const MODELO_PROFUNDO = "claude-opus-5-5";

/** Cierres y diagnósticos van con Opus (doc del plan); lo demás con Sonnet. */
export function modeloPara(texto: string): string {
  return /\b(cierre|cerr[oó]|diagn[oó]stic|margen|overhead|contribuci[oó]n|c[oó]mo va|c[oó]mo vamos|meta del mes)/i.test(texto) ? MODELO_PROFUNDO : MODELO_POR_DEFECTO;
}

const PRECIOS: Record<string, { entrada: number; salida: number; cacheLeido: number }> = {
  "claude-sonnet-5-5": { entrada: 2, salida: 10, cacheLeido: 0.1 },
  "claude-opus-5-5": { entrada: 4, salida: 20, cacheLeido: 0.2 },
  // Modelos a los que puede caer el respaldo del servidor ante un rechazo.
  "claude-sonnet-5": { entrada: 2, salida: 10, cacheLeido: 0.2 },
  "claude-opus-5": { entrada: 5, salida: 25, cacheLeido: 0.5 },
  "claude-opus-4-8": { entrada: 5, salida: 25, cacheLeido: 0.5 },
};

export interface Uso {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Costo de una respuesta. La escritura en caché cuesta 1,25 veces la entrada. */
export function costoUsd(modelo: string, uso: Uso): number {
  const p = PRECIOS[modelo] ?? PRECIOS[MODELO_POR_DEFECTO]!;
  const millon = 1_000_000;
  return (
    (uso.input_tokens * p.entrada +
      uso.output_tokens * p.salida +
      (uso.cache_read_input_tokens ?? 0) * p.cacheLeido +
      (uso.cache_creation_input_tokens ?? 0) * p.entrada * 1.25) /
    millon
  );
}

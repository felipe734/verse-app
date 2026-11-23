import type { ResultadoReconciliacion } from "@/lib/sync/reconciliar";

/**
 * Detalle de las Corridas de la app con el formato de verse-trazabilidad: exactamente dos
 * líneas, "Encontró: …" y "Hizo: …", con conteos y nombres, sin montos.
 */
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

export function detalleRespaldo(
  d: { tablas: number; hechas: number; fallidas: number; filas: number; bytes: number; adjuntos: number; bytesAdjuntos: number },
  fallidas: string[],
): string {
  const encontro = `Encontró: ${d.tablas} tablas de las bases de la app con ${d.filas} filas y ${d.adjuntos} adjuntos nuevos`;
  const hizo = `Hizo: respaldó ${d.hechas} de ${d.tablas} tablas (${mb(d.bytes)}) y ${d.adjuntos} adjuntos (${mb(d.bytesAdjuntos)}) en Drive${
    fallidas.length ? `; fallaron ${fallidas.join("; ")}` : ""
  }`;
  return `${encontro}\n${hizo}`;
}

const NOMBRES: Record<string, string> = {
  trazabilidadVerse: "TRAZABILIDAD VERSE",
  trazabilidadCyC: "TRAZABILIDAD C&C",
  unidadesHost: "UNIDADES Host",
  unidadesLiving: "UNIDADES Living",
};

export function detalleApp(
  resultados: ResultadoReconciliacion[],
  extra: { llamadas: Record<string, number>; neonUsd: number | null; errores: string[]; respaldoAyer: string; webhooks: number },
): string {
  const tablas = resultados
    .map((r) => `${NOMBRES[r.clave] ?? r.clave} ${r.filasAirtable} filas ${r.cuadra ? "cuadra" : `no cuadraba (faltaban ${r.faltaban}, sobraban ${r.sobraban}, distintas ${r.distintas})`}`)
    .join(", ");
  const llamadas = Object.entries(extra.llamadas)
    .map(([w, n]) => `${w} ${n}`)
    .join(", ");
  const encontro = `Encontró: ${tablas}; respaldo de anoche ${extra.respaldoAyer}${extra.errores.length ? `; errores: ${extra.errores.join("; ")}` : ""}`;
  const hizo = `Hizo: reconcilió ${resultados.length} tablas, renovó ${extra.webhooks} webhooks; llamadas a Airtable ${llamadas || "0"}; Neon ${
    extra.neonUsd === null ? "sin medir" : "medido"
  }`;
  return `${encontro}\n${hizo}`;
}

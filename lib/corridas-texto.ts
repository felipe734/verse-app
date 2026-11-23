import type { ResultadoReconciliacion } from "@/lib/sync/reconciliar";

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

export function detalleRespaldo(
  d: { tablas: number; hechas: number; fallidas: number; filas: number; bytes: number; adjuntos: number; bytesAdjuntos: number },
  fallidas: string[],
): string {
  const lineas = [
    `Tablas: ${d.hechas} de ${d.tablas}${d.fallidas ? `, ${d.fallidas} fallidas` : ""}`,
    `Filas: ${d.filas}`,
    `Datos: ${mb(d.bytes)}`,
    `Adjuntos nuevos: ${d.adjuntos} (${mb(d.bytesAdjuntos)})`,
  ];
  if (fallidas.length) lineas.push(`Fallaron: ${fallidas.join("; ")}`);
  return lineas.join("\n");
}

export function detalleApp(
  resultados: ResultadoReconciliacion[],
  extra: { llamadas: Record<string, number>; neonUsd: number | null; errores: string[]; respaldoAyer: string },
): string {
  const lineas = resultados.map(
    (r) =>
      `${r.clave}: ${r.filasAirtable} filas, ${r.cuadra ? "cuadra" : `no cuadraba (faltaban ${r.faltaban}, sobraban ${r.sobraban}, distintas ${r.distintas})`}`,
  );
  const llamadas = Object.entries(extra.llamadas)
    .map(([w, n]) => `${w} ${n}`)
    .join(", ");
  lineas.push(`Llamadas a Airtable: ${llamadas || "0"}`);
  lineas.push(`Neon: ${extra.neonUsd === null ? "sin medir" : `US$${extra.neonUsd} en el período`}`);
  lineas.push(`Respaldo de anoche: ${extra.respaldoAyer}`);
  if (extra.errores.length) lineas.push(`Errores: ${extra.errores.join("; ")}`);
  return lineas.join("\n");
}

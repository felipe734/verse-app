import { REGISTRO } from "@/lib/modulos/registro";
import { leerPeriodo } from "@/lib/vistas/periodo";

/**
 * Lo que la persona está viendo, en palabras: módulo, período, filtros, vista, Mío o Todo y la
 * fila abierta. Así "¿cuáles de estas están atrasadas?" funciona sin explicar nada.
 */
export function describirPantalla(ruta: string, seleccion: string | null | undefined, hoy: string): string {
  const [camino = "", consulta = ""] = ruta.split("?");
  const params = new URLSearchParams(consulta);
  const [, empresa, , segmento] = camino.split("/");
  const def = REGISTRO.find((d) => d.segmento === segmento && (d.tabla || d.pestanas));
  const partes: string[] = [`Pantalla: ${camino}`];
  if (def) {
    const tabla = def.tabla ?? def.pestanas?.find((p) => p.id === params.get("pestana"))?.tabla ?? def.pestanas?.[0]?.tabla;
    partes.push(`módulo ${def.nombre}${empresa ? ` (${empresa})` : ""}`);
    if (tabla?.periodo) partes.push(`período ${leerPeriodo(tabla.periodo.unidad, params.get("p") ?? undefined, hoy).etiqueta}`);
    if (params.get("pestana")) partes.push(`pestaña ${params.get("pestana")}`);
    const filtros = [...params.entries()].filter(([k]) => k.startsWith("f.")).map(([k, v]) => `${k.slice(2)} = ${v}`);
    if (filtros.length) partes.push(`filtros: ${filtros.join(", ")}`);
    if (params.get("v")) partes.push(`vista ${params.get("v")}`);
    if (params.get("quien")) partes.push(params.get("quien") === "mio" ? "solo lo suyo" : "de todos");
  }
  if (seleccion) partes.push(`fila abierta: ${seleccion}`);
  return `${partes.join(" · ")}.`;
}

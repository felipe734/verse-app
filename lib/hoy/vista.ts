import { TABLAS } from "@/lib/airtable/mapeo";
import type { FilaVista } from "@/components/modulos/tipos";
import { accion, esCritico, etiquetaAtraso, type TareaHoy } from "./clasificar";

const enAirtable = (empresa: "Verse" | "C&C", recId: string) => {
  const t = empresa === "Verse" ? TABLAS.trazabilidadVerse : TABLAS.trazabilidadCyC;
  return `https://airtable.com/${t.idBase}/${t.idTabla}/${recId}`;
};

/** De una fila de TRAZABILIDAD a lo que pinta la pantalla. */
export function aVista(t: TareaHoy & { atraso?: number; puedeEditar?: boolean }): FilaVista {
  return {
    recId: t.recId,
    empresa: t.empresa,
    numero: t.numero,
    asunto: t.asunto,
    accion: accion(t),
    resto: (t.detalle ?? "").split("\n").slice(1).join("\n").trim(),
    estado: t.estado,
    responsable: t.responsable,
    fechaLimite: t.fechaLimite,
    proceso: t.proceso,
    linea: t.linea,
    link: t.link,
    critico: esCritico(t),
    atraso: t.atraso ?? 0,
    etiqueta: etiquetaAtraso(t.atraso ?? 0),
    puedeEditar: Boolean(t.puedeEditar),
    urlAirtable: enAirtable(t.empresa, t.recId),
    urlCorrida: t.corrida[0] ? enAirtable(t.empresa, t.corrida[0]) : null,
  };
}

import { TABLAS } from "@/lib/airtable/mapeo";
import { accion, esCritico, etiquetaAtraso } from "@/lib/hoy/clasificar";
import type { ItemHoy } from "@/lib/hoy/datos";

const enAirtable = (empresa: "Verse" | "C&C", recId: string) => {
  const t = empresa === "Verse" ? TABLAS.trazabilidadVerse : TABLAS.trazabilidadCyC;
  return `https://airtable.com/${t.idBase}/${t.idTabla}/${recId}`;
};

const fechaCorta = (f: string | null) =>
  f ? new Date(`${f}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }) : "sin fecha";

/** Un pendiente de Hoy: resumen a la vista y, al tocar, el detalle con su link y su corrida. */
export function Item({ t, conEmpresa, acciones }: { t: ItemHoy; conEmpresa: boolean; acciones?: React.ReactNode }) {
  const etiqueta = etiquetaAtraso(t.atraso);
  const resto = (t.detalle ?? "").split("\n").slice(1).join("\n").trim();
  return (
    <details className="group py-2.5" data-numero={t.numero ?? undefined} data-empresa={t.empresa}>
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <b className="text-foreground">{t.asunto ?? "Sin asunto"}</b>
          {(etiqueta || esCritico(t)) && (
            <span className="shrink-0 rounded-full bg-[var(--verse-azul-claro)] px-2.5 py-0.5 font-display text-[11px] text-[var(--verse-azul)]">
              {esCritico(t) ? "Crítico" : etiqueta}
            </span>
          )}
        </div>
        <div className="text-[13.5px]">{accion(t)}</div>
        <div className="text-[12.5px] text-muted-foreground">
          {[t.responsable, t.proceso, conEmpresa ? t.empresa : null, fechaCorta(t.fechaLimite), t.estado === "En espera" ? "En espera" : null, t.atraso ? `${t.atraso} d de atraso` : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </summary>
      <div className="mt-2 space-y-2 rounded-xl bg-[var(--verse-lienzo)] px-4 py-3 text-[13.5px]">
        {resto && <p className="whitespace-pre-line">{resto}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {t.link && (
            <a className="text-[var(--verse-azul)] underline" href={t.link} target="_blank" rel="noreferrer">
              {t.link.includes("mail.google.com") ? "Abrir el correo" : "Abrir el link"}
            </a>
          )}
          {t.corrida[0] && (
            <a className="text-[var(--verse-azul)] underline" href={enAirtable(t.empresa, t.corrida[0])} target="_blank" rel="noreferrer">
              Ver la corrida
            </a>
          )}
          <a className="text-[var(--verse-azul)] underline" href={enAirtable(t.empresa, t.recId)} target="_blank" rel="noreferrer">
            Fila {t.numero ?? ""} en Airtable
          </a>
        </div>
        {acciones}
      </div>
    </details>
  );
}

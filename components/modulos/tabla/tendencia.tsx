import type { Tendencia } from "@/lib/modulos/tendencia";
import { cn } from "@/lib/utils";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const corto = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M` : pesos.format(v));
const TONOS = ["bg-acento", "bg-muted-foreground/40"];

/** Año corrido por mes, con el total del año y el del mes que se está viendo. Sobrio: barras y cifras. */
export function GraficaTendencia({ t, mes, hoy }: { t: Tendencia; mes?: string; hoy: string }) {
  const hasta = Number(hoy.slice(5, 7));
  const meses = t.meses.slice(0, hasta);
  const max = Math.max(1, ...meses.flatMap((m) => m.valores));
  const totalAnio = t.etiquetas.map((_, i) => meses.reduce((n, m) => n + m.valores[i]!, 0));
  const elegido = t.meses.find((m) => m.mes === mes) ?? meses[meses.length - 1];
  return (
    <section aria-label="Tendencia del año" className="mb-4 grid gap-2 lg:grid-cols-[1fr_16rem]">
      <figure className="rounded-lg border bg-card p-3">
        <figcaption className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {t.anio} por mes
          {t.etiquetas.map((e, i) => (
            <span key={e} className="inline-flex items-center gap-1">
              <span className={cn("size-2.5 rounded-sm", TONOS[i])} aria-hidden /> {e}
            </span>
          ))}
        </figcaption>
        <div className="flex h-32 items-end gap-1.5" aria-hidden>
          {meses.map((m) => (
            <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-0.5">
                {m.valores.map((v, i) => (
                  <div key={i} title={`${MESES[Number(m.mes.slice(5)) - 1]}: ${pesos.format(v)}`} className={cn("w-full max-w-4 rounded-t", TONOS[i], m.mes !== elegido?.mes && "opacity-60")} style={{ height: `${(Math.max(0, v) / max) * 100}%` }} />
                ))}
              </div>
              <span className={cn("text-[11px] text-muted-foreground", m.mes === elegido?.mes && "font-semibold text-foreground")}>{MESES[Number(m.mes.slice(5)) - 1]}</span>
            </div>
          ))}
        </div>
        <table className="sr-only">
          <caption>{t.etiquetas.join(" y ")} por mes</caption>
          <tbody>
            {meses.map((m) => (
              <tr key={m.mes}>
                <td>{m.mes}</td>
                {m.valores.map((v, i) => (
                  <td key={i}>{pesos.format(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Año corrido · {t.etiquetas[0]}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{corto(totalAnio[0] ?? 0)}</dd>
        </div>
        {elegido && (
          <div className="rounded-lg border bg-card p-3">
            <dt className="text-xs text-muted-foreground">
              {MESES[Number(elegido.mes.slice(5)) - 1]} {elegido.mes.slice(0, 4)} · {t.etiquetas[0]}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{corto(elegido.valores[0] ?? 0)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

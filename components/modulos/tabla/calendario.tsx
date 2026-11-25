"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DefAgenda, DefCalendario, FilaTabla } from "@/lib/modulos/tabla";
import type { Periodo } from "@/lib/vistas/periodo";
import { leerFecha } from "@/lib/vistas/fechas";
import { sumarDias } from "@/lib/vistas/periodo";

export { leerFecha };
import { cn } from "@/lib/utils";


const minutos = (hora: string) => {
  const m = hora.match(/^(\d{1,2}):(\d{2}) ([ap])/);
  return m ? ((Number(m[1]) % 12) + (m[3] === "p" ? 12 : 0)) * 60 + Number(m[2]) : 24 * 60;
};

const dias = (p: Pick<Periodo, "inicio" | "fin">) => {
  const lista: string[] = [];
  for (let d = p.inicio; d < p.fin; d = sumarDias(d, 1)) lista.push(d);
  return lista;
};

const LETRA = ["D", "L", "M", "M", "J", "V", "S"];
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIA_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const diaDe = (t: string) => new Date(`${t}T12:00:00Z`).getUTCDay();

/** Color estable por valor (plataforma): solo tokens del tema, sin colores de marca de terceros. */
const TONOS = ["bg-acento/80 text-acento-foreground", "bg-chart-2/80 text-white", "bg-chart-4/90 text-black", "bg-chart-1/80 text-white", "bg-chart-3/80 text-white", "bg-muted-foreground/60 text-white"];
const tonoDe = (valores: string[], v: string) => TONOS[Math.max(0, valores.indexOf(v)) % TONOS.length]!;


/**
 * Calendario de ocupación tipo Airbnb: una fila por unidad, una columna por día del período y
 * una barra por reserva. En celular se ve como agenda de llegadas y salidas por día.
 */
export function Calendario({ def, filas, periodo, hoy, alAbrir }: { def: DefCalendario; filas: FilaTabla[]; periodo: Periodo; hoy: string; alAbrir: (f: FilaTabla) => void }) {
  const ds = useMemo(() => dias(periodo), [periodo]);
  const caja = useRef<HTMLDivElement>(null);
  // Ventana continua: arranca mostrando desde un par de días antes de hoy; lo demás, con scroll.
  useEffect(() => {
    const i = ds.indexOf(hoy);
    if (caja.current && i > 2) caja.current.scrollLeft = (i - 2) * 36;
  }, [ds, hoy]);
  const reservas = useMemo(
    () =>
      filas
        .map((f) => ({ f, ini: leerFecha(f.celdas[def.inicio])?.fecha, fin: leerFecha(f.celdas[def.fin])?.fecha, unidad: f.celdas[def.fila] || "Sin unidad", color: def.color ? f.celdas[def.color] ?? "" : "" }))
        .filter((r): r is typeof r & { ini: string; fin: string } => Boolean(r.ini && r.fin)),
    [filas, def],
  );
  const unidades = useMemo(() => [...new Set(reservas.map((r) => r.unidad))].sort((a, b) => a.localeCompare(b, "es", { numeric: true })), [reservas]);
  const colores = useMemo(() => [...new Set(reservas.map((r) => r.color).filter(Boolean))].sort(), [reservas]);
  // Noches ocupadas por unidad sin contar dos veces una noche con reservas que se pisan.
  const noches = unidades.reduce((s, u) => s + ds.filter((d) => reservas.some((r) => r.unidad === u && d >= r.ini && d < r.fin)).length, 0);
  const ocupacion = unidades.length ? Math.round((noches / (unidades.length * ds.length)) * 100) : 0;

  const llegadas = reservas.filter((r) => r.ini === hoy);
  const salidas = reservas.filter((r) => r.fin === hoy);

  return (
    <div className="space-y-4">
      {periodo.actual && (
        <section aria-label="Hoy" className="grid gap-2 sm:grid-cols-2">
          {[
            [def.textos?.entran ?? "Llegan hoy", llegadas],
            [def.textos?.salen ?? "Salen hoy", salidas],
          ].map(([titulo, lista]) => (
            <div key={titulo as string} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {titulo as string} · {(lista as typeof reservas).length}
              </p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {(lista as typeof reservas).length === 0 && <li className="text-muted-foreground">Nadie</li>}
                {(lista as typeof reservas).map((r) => (
                  <li key={r.f.id}>
                    <button type="button" className="hover:underline" onClick={() => alAbrir(r.f)}>
                      {r.unidad}
                      {r.color ? <span className="text-muted-foreground"> · {r.color}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          {def.textos?.ocupacion ?? "Ocupación de las unidades con reservas"}: <strong className="text-foreground tabular-nums">{ocupacion}%</strong>
        </span>
        {colores.map((c) => (
          <span key={c} className="inline-flex items-center gap-1">
            <span className={cn("size-2.5 rounded-sm", tonoDe(colores, c))} aria-hidden /> {c}
          </span>
        ))}
      </div>

      {/* Computador: cuadrícula unidades × días */}
      <div ref={caja} className="overflow-x-auto rounded-lg border max-md:hidden" role="grid" aria-label="Calendario de reservas">
        <div className="grid min-w-max" style={{ gridTemplateColumns: `11rem repeat(${ds.length}, 2.25rem)` }}>
          <div className="sticky left-0 z-10 border-b bg-card px-3 py-2 text-xs font-medium">Unidad</div>
          {ds.map((d) => (
            <div key={d} className={cn("border-b border-l px-0.5 py-1 text-center text-[11px] leading-tight", d === hoy && "bg-acento-suave font-semibold", [0, 6].includes(diaDe(d)) && "bg-muted/40")}>
              <div className={cn("text-muted-foreground", (d.endsWith("-01") || d === ds[0]) && "font-semibold text-foreground")}>{d.endsWith("-01") || d === ds[0] ? MES_CORTO[Number(d.slice(5, 7)) - 1] : LETRA[diaDe(d)]}</div>
              <div className="tabular-nums">{Number(d.slice(8))}</div>
            </div>
          ))}
          {unidades.map((u) => {
            const deU = reservas.filter((r) => r.unidad === u);
            return (
              <div key={u} className="contents" role="row">
                <div className="sticky left-0 z-10 truncate border-b bg-card px-3 py-2 text-sm font-medium" role="rowheader" title={u}>
                  {u}
                </div>
                <div className="relative border-b" style={{ gridColumn: `span ${ds.length}` }}>
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${ds.length}, 2.25rem)` }} aria-hidden>
                    {ds.map((d) => (
                      <div key={d} className={cn("border-l", d === hoy && "bg-acento-suave", [0, 6].includes(diaDe(d)) && "bg-muted/30")} />
                    ))}
                  </div>
                  {deU.map((r) => {
                    const a = Math.max(0, ds.indexOf(r.ini < ds[0]! ? ds[0]! : r.ini));
                    const finVisible = r.fin > ds[ds.length - 1]! ? ds.length : ds.indexOf(r.fin);
                    const b = finVisible < 0 ? ds.length : finVisible;
                    if (b <= a && !(r.ini === r.fin)) return null;
                    const ancho = Math.max(1, b - a);
                    return (
                      <button
                        key={r.f.id}
                        type="button"
                        onClick={() => alAbrir(r.f)}
                        title={`${u} · ${r.color} · ${r.f.celdas[def.inicio]} a ${r.f.celdas[def.fin]}`}
                        className={cn("absolute top-1.5 bottom-1.5 truncate rounded-md px-1.5 text-left text-[11px] font-medium shadow-sm", tonoDe(colores, r.color))}
                        style={{ left: `calc(${a} * 2.25rem + 1.125rem)`, width: `calc(${ancho} * 2.25rem - 0.25rem)` }}
                      >
                        {(def.etiqueta && r.f.celdas[def.etiqueta]) || r.color || "Reserva"}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {unidades.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No hay reservas en este período.</p>}
      </div>

      {/* Celular: agenda por día con llegadas y salidas */}
      <ol className="space-y-3 md:hidden" aria-label="Agenda de reservas">
        {ds
          .map((d) => ({ d, entran: reservas.filter((r) => r.ini === d), salen: reservas.filter((r) => r.fin === d) }))
          .filter((x) => x.entran.length || x.salen.length)
          .map((x) => (
            <li key={x.d} className={cn("rounded-lg border bg-card p-3", x.d === hoy && "border-acento")}>
              <p className="text-sm font-medium">
                {DIA_SEMANA[diaDe(x.d)]} {Number(x.d.slice(8))}
              </p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {x.entran.map((r) => (
                  <li key={`e${r.f.id}`}>
                    <button type="button" onClick={() => alAbrir(r.f)}>
                      <span className="text-muted-foreground">Llega</span> {r.unidad}
                    </button>
                  </li>
                ))}
                {x.salen.map((r) => (
                  <li key={`s${r.f.id}`}>
                    <button type="button" onClick={() => alAbrir(r.f)}>
                      <span className="text-muted-foreground">Sale</span> {r.unidad}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
      </ol>
    </div>
  );
}


/** Agenda de la semana: una fila por funcionaria y una columna por día, con la hora de cada servicio. */
export function Agenda({
  def,
  filas,
  periodo,
  hoy,
  alAbrir,
  accion,
  mover,
}: {
  def: DefAgenda;
  filas: FilaTabla[];
  periodo: Periodo;
  hoy: string;
  alAbrir: (f: FilaTabla) => void;
  accion?: (f: FilaTabla) => React.ReactNode;
  /** Arrastrar una tarjeta a otro día la mueve (misma hora). */
  mover?: (f: FilaTabla, fecha: string) => void;
}) {
  const ds = useMemo(() => dias(periodo), [periodo]);
  const [encima, setEncima] = useState<string | null>(null);
  const items = useMemo(
    () =>
      filas
        .map((f) => ({ f, cuando: leerFecha(f.celdas[def.fecha]), fila: f.celdas[def.fila] || "Sin asignar" }))
        .filter((x): x is typeof x & { cuando: { fecha: string; hora: string } } => Boolean(x.cuando))
        .sort((a, b) => minutos(a.cuando.hora) - minutos(b.cuando.hora)),
    [filas, def],
  );
  const personas = [...new Set(items.map((x) => x.fila))].sort((a, b) => (a === "Sin asignar" ? 1 : b === "Sin asignar" ? -1 : a.localeCompare(b, "es")));
  const tarjeta = (x: (typeof items)[number]) => {
    const terminado = def.estado && /termin|hech/i.test(x.f.celdas[def.estado] ?? "");
    return (
      <div
        key={x.f.id}
        draggable={Boolean(mover) && !terminado}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", x.f.id)}
        className={cn(
          "flex items-center gap-1 rounded-md border bg-card pr-1 hover:border-foreground/20",
          terminado && "border-emerald-500/30 bg-emerald-500/10",
          !terminado && x.fila === "Sin asignar" && "border-red-500/40 bg-red-500/5",
          mover && !terminado && "cursor-grab active:cursor-grabbing",
        )}
      >
        <button type="button" onClick={() => alAbrir(x.f)} className="min-w-0 flex-1 px-2 py-1.5 text-left text-xs">
          <span className="tabular-nums text-muted-foreground">{x.cuando.hora || "—"}</span> <span className="font-medium">{x.f.celdas[def.titulo] || "—"}</span>
        </button>
        {accion?.(x.f)}
      </div>
    );
  };
  return (
    <>
      <div className="overflow-x-auto rounded-lg border max-md:hidden" aria-label="Agenda de la semana">
        <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-36 border-b px-3 py-2 text-left text-xs font-medium">{def.etiquetaFila ?? def.fila}</th>
              {ds.map((d) => (
                <th key={d} className={cn("border-b border-l px-2 py-2 text-left text-xs font-medium", d === hoy && "bg-acento-suave")}>
                  {DIA_SEMANA[diaDe(d)]} {Number(d.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personas.map((p) => (
              <tr key={p}>
                <th scope="row" className="border-b px-3 py-2 text-left align-top text-sm font-medium">
                  {p}
                </th>
                {ds.map((d) => (
                  <td
                    key={d}
                    onDragOver={(e) => {
                      if (!mover || d < hoy) return;
                      e.preventDefault();
                      setEncima(`${p}|${d}`);
                    }}
                    onDragLeave={() => setEncima((x) => (x === `${p}|${d}` ? null : x))}
                    onDrop={(e) => {
                      setEncima(null);
                      const id = e.dataTransfer.getData("text/plain");
                      const f = filas.find((x) => x.id === id);
                      const cuando = f ? leerFecha(f.celdas[def.fecha]) : null;
                      if (f && mover && cuando && cuando.fecha !== d && d >= hoy) mover(f, d);
                    }}
                    className={cn("border-b border-l p-1.5 align-top", d === hoy && "bg-acento-suave/50", encima === `${p}|${d}` && "bg-acento-suave")}
                  >
                    <div className="space-y-1">{items.filter((x) => x.fila === p && x.cuando.fecha === d).map(tarjeta)}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {personas.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No hay servicios esta semana.</p>}
      </div>
      <ol className="space-y-3 md:hidden" aria-label="Agenda por día">
        {ds
          .map((d) => ({ d, lista: items.filter((x) => x.cuando.fecha === d) }))
          .filter((x) => x.lista.length)
          .map((x) => (
            <li key={x.d} className={cn("rounded-lg border bg-card p-3", x.d === hoy && "border-acento")}>
              <p className="mb-1.5 text-sm font-medium">
                {DIA_SEMANA[diaDe(x.d)]} {Number(x.d.slice(8))}
              </p>
              <div className="space-y-1">
                {x.lista.map((y) => (
                  <div key={y.f.id} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{y.fila}</span>
                    <div className="min-w-0 flex-1">{tarjeta(y)}</div>
                  </div>
                ))}
              </div>
            </li>
          ))}
      </ol>
    </>
  );
}

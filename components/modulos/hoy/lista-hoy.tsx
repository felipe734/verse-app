"use client";

import { CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, List, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BarraControles } from "@/components/modulos/barra-controles";
import { useShell } from "@/components/shell/contexto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Accion, ResultadoAccion } from "@/lib/hoy/acciones";
import { fechaCorta, lunes, sumarDias } from "@/lib/hoy/fechas";
import { cn } from "@/lib/utils";
import { PendienteDetalle } from "../pendiente-detalle";
import type { FilaVista } from "../tipos";

export interface SeccionVista {
  id: string;
  titulo: string;
  filas: FilaVista[];
}

type Ejecutar = (recId: string, accion: Accion) => Promise<ResultadoAccion>;

const UMBRAL = 90;

function Fila({ f, conEmpresa, abrir, actuar, hoy }: { f: FilaVista; conEmpresa: boolean; abrir: () => void; actuar: (a: Accion) => void; hoy: string }) {
  const [dx, setDx] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef(false);
  const activo = f.puedeEditar;

  return (
    <li className="relative overflow-hidden">
      {activo && dx !== 0 && (
        <div aria-hidden className={cn("absolute inset-0 flex items-center px-4 text-sm font-medium", dx > 0 ? "justify-start bg-acento text-acento-foreground" : "justify-end bg-muted text-foreground")}>
          {dx > 0 ? "Hecho" : "Mover a mañana"}
        </div>
      )}
      <div
        style={{ transform: `translateX(${dx}px)`, transition: arrastrando ? "none" : "transform 150ms" }}
        className="group relative flex items-center gap-3 bg-background px-4 py-2.5 hover:bg-muted/50 md:px-6"
        onPointerDown={(e) => {
          if (!activo || e.pointerType === "mouse") return;
          inicio.current = { x: e.clientX, y: e.clientY };
          horizontal.current = false;
          setArrastrando(true);
        }}
        onPointerMove={(e) => {
          if (!inicio.current) return;
          const x = e.clientX - inicio.current.x;
          const y = e.clientY - inicio.current.y;
          if (!horizontal.current && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y)) horizontal.current = true;
          if (horizontal.current) setDx(Math.max(-140, Math.min(140, x)));
        }}
        onPointerUp={() => {
          const final = dx;
          inicio.current = null;
          setArrastrando(false);
          setDx(0);
          if (final >= UMBRAL) actuar({ tipo: "cerrar" });
          else if (final <= -UMBRAL) actuar({ tipo: "aplazar", hasta: sumarDias(hoy, 1) });
        }}
        onPointerCancel={() => {
          inicio.current = null;
          setArrastrando(false);
          setDx(0);
        }}
      >
        {activo ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => actuar({ tipo: "cerrar" })}
                aria-label={`Hecho: ${f.asunto ?? ""}`}
                className="flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-transparent transition-colors hover:border-acento hover:bg-acento hover:text-acento-foreground focus-visible:text-acento-foreground"
              >
                <Check className="size-3" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>Hecho</TooltipContent>
          </Tooltip>
        ) : (
          <span aria-hidden className="size-4 shrink-0 rounded-full border border-dashed border-muted-foreground/30" />
        )}
        <button type="button" onClick={abrir} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left outline-none focus-visible:ring-0">
          <span className="flex w-full min-w-0 items-center gap-2">
            {f.critico && <span aria-label="Crítico" className="size-1.5 shrink-0 rounded-full bg-destructive" />}
            <span className="truncate text-sm font-medium">{f.asunto ?? "Sin asunto"}</span>
          </span>
          <span className="w-full truncate text-[13px] text-muted-foreground">{f.accion}</span>
        </button>
        <span className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
          {conEmpresa && <Badge variant="outline">{f.empresa}</Badge>}
          {f.proceso && <span className="hidden max-w-[140px] truncate lg:inline">{f.proceso}</span>}
          {f.responsable && <span className="w-16 truncate text-right">{f.responsable}</span>}
          <span className={cn("w-20 text-right tabular-nums", f.atraso > 0 && "text-foreground")}>{f.etiqueta ?? fechaCorta(f.fechaLimite)}</span>
        </span>
        {activo && <MenuMover hoy={hoy} actuar={actuar} abrir={abrir} />}
      </div>
    </li>
  );
}

/** Fechas a las que se mueve un pendiente, las mismas en la fila, el detalle y el calendario. */
function destinos(hoy: string): { etiqueta: string; fecha: string }[] {
  return [
    { etiqueta: "Mañana", fecha: sumarDias(hoy, 1) },
    { etiqueta: "El lunes", fecha: lunes(hoy) },
    { etiqueta: "En una semana", fecha: sumarDias(hoy, 7) },
    { etiqueta: "En dos semanas", fecha: sumarDias(hoy, 14) },
  ];
}

/** Menú de la fila: mover a otra fecha (o elegirla) y descartar. Hecho va aparte, a la vista. */
function MenuMover({ hoy, actuar, abrir }: { hoy: string; actuar: (a: Accion) => void; abrir: () => void }) {
  const [fecha, setFecha] = useState(sumarDias(hoy, 1));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground" aria-label="Mover o descartar">
          <CalendarClock className="size-3.5" aria-hidden /> <span className="max-sm:sr-only">Mover</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Mover a</DropdownMenuLabel>
        {destinos(hoy).map((d) => (
          <DropdownMenuItem key={d.etiqueta} onSelect={() => actuar({ tipo: "aplazar", hasta: d.fecha })} className="justify-between">
            {d.etiqueta} <span className="text-xs text-muted-foreground">{fechaCorta(d.fecha)}</span>
          </DropdownMenuItem>
        ))}
        <div className="flex items-center gap-1.5 px-2 py-1.5" onKeyDown={(e) => e.stopPropagation()}>
          <Input type="date" aria-label="Otra fecha" min={sumarDias(hoy, 1)} value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-7 flex-1 text-xs" />
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => actuar({ tipo: "aplazar", hasta: fecha })}>
            Mover
          </Button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={abrir}>Abrir el detalle</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actuar({ tipo: "descartar" })} className="text-destructive focus:text-destructive">
          <X className="size-4" aria-hidden /> Descartar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccionesDetalle({ f, hoy, actuar }: { f: FilaVista; hoy: string; actuar: (a: Accion) => void }) {
  const [fecha, setFecha] = useState(sumarDias(hoy, 1));
  if (!f.puedeEditar) return <p className="text-sm text-muted-foreground">Solo lectura: tu acceso no edita este pendiente.</p>;
  return (
    <div className="space-y-3">
      <Button className="w-full bg-acento text-acento-foreground hover:bg-acento/90" onClick={() => actuar({ tipo: "cerrar" })}>
        <Check className="size-4" aria-hidden /> Hecho
      </Button>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Mover a</p>
        <div className="grid grid-cols-2 gap-2">
          {destinos(hoy).map((d) => (
            <Button key={d.etiqueta} variant="outline" size="sm" className="justify-between" onClick={() => actuar({ tipo: "aplazar", hasta: d.fecha })}>
              {d.etiqueta} <span className="text-xs text-muted-foreground">{fechaCorta(d.fecha)}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" aria-label="Otra fecha" min={sumarDias(hoy, 1)} value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-8 flex-1" />
          <Button size="sm" variant="outline" onClick={() => actuar({ tipo: "aplazar", hasta: fecha })}>
            Mover
          </Button>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => actuar({ tipo: "descartar" })}>
        <X className="size-4" aria-hidden /> Descartar
      </Button>
    </div>
  );
}

const CLAVE_PLEGADAS = "verse-hoy-plegadas";
const PLEGADAS_INICIO: Record<string, boolean> = { semana: true, luego: true };

/** Grupos plegados de Hoy, recordados en el navegador. "Hoy" nunca se pliega. */
function usePlegadas(): [Record<string, boolean>, (id: string) => void] {
  const [plegadas, setPlegadas] = useState<Record<string, boolean>>(PLEGADAS_INICIO);
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const g = localStorage.getItem(CLAVE_PLEGADAS);
        if (g) setPlegadas(JSON.parse(g) as Record<string, boolean>);
      } catch {
        /* sin almacenamiento */
      }
    });
  }, []);
  const alternar = (id: string) =>
    setPlegadas((p) => {
      const n = { ...p, [id]: !p[id] };
      try {
        localStorage.setItem(CLAVE_PLEGADAS, JSON.stringify(n));
      } catch {
        /* sin almacenamiento */
      }
      return n;
    });
  return [plegadas, alternar];
}

const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/** Calendario del mes: cada pendiente en su fecha límite. Se arrastra a otro día para moverlo. */
function CalendarioHoy({ filas, hoy, abrir, mover }: { filas: FilaVista[]; hoy: string; abrir: (f: FilaVista) => void; mover: (f: FilaVista, fecha: string) => void }) {
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [encima, setEncima] = useState<string | null>(null);
  const primero = `${mes}-01`;
  const desfase = (new Date(`${primero}T12:00:00Z`).getUTCDay() + 6) % 7;
  const inicio = sumarDias(primero, -desfase);
  const enMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
  const dias = Array.from({ length: Math.ceil((desfase + enMes) / 7) * 7 }, (_, i) => sumarDias(inicio, i));
  const porDia = useMemo(() => {
    const m = new Map<string, FilaVista[]>();
    for (const f of filas) {
      // Lo vencido se ve en hoy, para no perderlo en un mes pasado.
      const d = !f.fechaLimite || f.fechaLimite < hoy ? hoy : f.fechaLimite;
      m.set(d, [...(m.get(d) ?? []), f]);
    }
    return m;
  }, [filas, hoy]);
  const cambiarMes = (n: number) => {
    const [a, m] = mes.split("-").map(Number) as [number, number];
    const t = a * 12 + (m - 1) + n;
    setMes(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`);
  };
  const nombreMes = new Date(`${primero}T12:00:00Z`).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).replace(/ de /, " ").replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="px-4 pb-10 md:px-6">
      <div className="mb-2 flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium">{nombreMes}</span>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div role="grid" aria-label="Calendario de pendientes" className="grid grid-cols-7 overflow-hidden rounded-lg border text-xs">
        {DIAS.map((d) => (
          <div key={d} role="columnheader" className="border-b bg-muted/50 px-2 py-1 font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {dias.map((d) => {
          const items = porDia.get(d) ?? [];
          const fuera = d.slice(0, 7) !== mes;
          const pasado = d < hoy;
          return (
            <div
              key={d}
              role="gridcell"
              aria-label={fechaCorta(d)}
              onDragOver={(e) => {
                if (pasado) return;
                e.preventDefault();
                setEncima(d);
              }}
              onDragLeave={() => setEncima((x) => (x === d ? null : x))}
              onDrop={(e) => {
                setEncima(null);
                const id = e.dataTransfer.getData("text/plain");
                const f = filas.find((x) => x.recId === id);
                if (f && !pasado && d !== f.fechaLimite) mover(f, d);
              }}
              className={cn("min-h-24 border-r border-b p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0", fuera && "bg-muted/30 text-muted-foreground", encima === d && "bg-acento-suave")}
            >
              <div className={cn("mb-1 flex size-5 items-center justify-center rounded-full tabular-nums", d === hoy && "bg-acento font-semibold text-acento-foreground")}>{Number(d.slice(8))}</div>
              <ul className="space-y-0.5">
                {items.slice(0, 3).map((f) => (
                  <li key={f.recId}>
                    <button
                      type="button"
                      draggable={f.puedeEditar}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", f.recId)}
                      onClick={() => abrir(f)}
                      className={cn(
                        "w-full truncate rounded px-1 py-0.5 text-left hover:bg-muted",
                        f.critico || (f.fechaLimite && f.fechaLimite < hoy) ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-muted/60",
                      )}
                    >
                      {f.asunto ?? "Sin asunto"}
                    </button>
                  </li>
                ))}
                {items.length > 3 && <li className="px-1 text-muted-foreground">+{items.length - 3} más</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Arrastra un pendiente a otro día para moverlo. Lo vencido se muestra en hoy.</p>
    </div>
  );
}

/**
 * Hoy: solo lo de quien entra (el Maestro puede ver a otra persona con Responsable). Grupos
 * Crítico, Vencido, Hoy, Esta semana y Más adelante; "Hoy" siempre abierto y el resto plegable.
 * Vista de lista o de calendario.
 */
export function ListaHoy({
  secciones,
  hoy,
  conEmpresa,
  ejecutar,
  soloLectura,
  responsables = [],
  responsable = "mio",
  yo = null,
}: {
  secciones: SeccionVista[];
  hoy: string;
  conEmpresa: boolean;
  ejecutar: Ejecutar;
  soloLectura?: boolean;
  responsables?: string[];
  responsable?: string;
  yo?: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { abrirAsistente, asistenteHabilitado } = useShell();
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set());
  const [texto, setTexto] = useState("");
  const [plegadas, alternar] = usePlegadas();
  const vista = params.get("v") === "calendario" ? "calendario" : "lista";
  // ?fila= abre el detalle (lo usa ⌘K); si cambia estando en la pantalla, se vuelve a abrir.
  const filaUrl = params.get("fila");
  const [abierta, setAbierta] = useState<string | null>(filaUrl);
  const [filaVista, setFilaVista] = useState(filaUrl);
  if (filaUrl !== filaVista) {
    setFilaVista(filaUrl);
    setAbierta(filaUrl);
  }

  const cambiarParametro = (clave: string, valor: string | null) => {
    const q = new URLSearchParams(params.toString());
    if (valor) q.set(clave, valor);
    else q.delete(clave);
    q.delete("fila");
    router.replace(`${window.location.pathname}${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  const filtrar = (f: FilaVista) => !quitadas.has(f.recId) && (!texto || `${f.asunto} ${f.accion} ${f.numero} ${f.proceso}`.toLowerCase().includes(texto.toLowerCase()));
  const visibles = secciones.map((s) => ({ ...s, filas: s.filas.filter(filtrar) }));
  const total = visibles.reduce((n, s) => n + s.filas.length, 0);
  const todas = secciones.flatMap((s) => s.filas);
  const detalle = todas.find((f) => f.recId === abierta) ?? null;
  const nombreResponsable = responsable === "mio" ? (yo ? "Míos" : "Todos") : responsable === "todos" ? "Todos" : responsable;

  function cerrarDetalle() {
    setAbierta(null);
    if (params.get("fila")) router.replace(window.location.pathname + window.location.search.replace(/[?&]fila=[^&]+/, "").replace(/^&/, "?"), { scroll: false });
  }

  function actuar(f: FilaVista, a: Accion) {
    if (soloLectura) return;
    setQuitadas((q) => new Set(q).add(f.recId));
    if (abierta === f.recId) cerrarDetalle();
    void ejecutar(f.recId, a).then((r) => {
      if (r.ok) {
        toast.success(r.mensaje, { description: f.asunto ?? undefined });
        router.refresh();
      } else {
        setQuitadas((q) => {
          const n = new Set(q);
          n.delete(f.recId);
          return n;
        });
        toast.error(r.mensaje, { description: "Airtable gana: la fila vuelve a su valor real." });
      }
    });
  }

  return (
    <>
      <BarraControles className="px-4 pt-1 md:px-6">
        <div role="radiogroup" aria-label="Tipo de vista" className="flex rounded-md border p-0.5">
          {(["lista", "calendario"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={vista === v}
              onClick={() => cambiarParametro("v", v === "lista" ? null : v)}
              className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-xs", vista === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {v === "lista" ? <List className="size-3.5" aria-hidden /> : <CalendarDays className="size-3.5" aria-hidden />}
              {v === "lista" ? "Lista" : "Calendario"}
            </button>
          ))}
        </div>
        {responsables.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                <span className="text-muted-foreground">Responsable:</span> {nombreResponsable}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={responsable} onValueChange={(v) => cambiarParametro("resp", v === "mio" ? null : v)}>
                {yo && <DropdownMenuRadioItem value="mio">Míos</DropdownMenuRadioItem>}
                <DropdownMenuRadioItem value="todos">Todos</DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {responsables.map((r) => (
                  <DropdownMenuRadioItem key={r} value={r}>
                    {r}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="relative ml-auto max-md:w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar" aria-label="Buscar pendientes" className="h-8 pl-8 md:w-52" />
        </div>
      </BarraControles>

      {vista === "calendario" ? (
        <CalendarioHoy
          filas={visibles.flatMap((s) => s.filas)}
          hoy={hoy}
          abrir={(f) => setAbierta(f.recId)}
          mover={(f, fecha) => (fecha <= hoy ? toast.error("Elige un día después de hoy") : actuar(f, { tipo: "aplazar", hasta: fecha }))}
        />
      ) : total === 0 ? (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-24 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Check className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <p className="font-medium">{texto ? "Nada con ese filtro" : "Nada pendiente"}</p>
          <p className="text-sm text-muted-foreground">{texto ? "Prueba con otra palabra." : "Lo que te asignen aparecerá aquí."}</p>
          {texto ? (
            <Button variant="outline" size="sm" onClick={() => setTexto("")}>
              Quitar filtro
            </Button>
          ) : (
            asistenteHabilitado && (
              <Button variant="outline" size="sm" onClick={() => abrirAsistente("Agrega pendiente para ")}>
                Crear un pendiente con el asistente
              </Button>
            )
          )}
        </div>
      ) : (
        visibles.map((s) => {
          const fija = s.id === "hoy";
          if (s.filas.length === 0 && !fija) return null;
          const plegada = !fija && Boolean(plegadas[s.id]) && !texto;
          return (
            <section key={s.id} aria-labelledby={`sec-${s.id}`}>
              <h2 id={`sec-${s.id}`} className="sticky top-14 z-10 border-b bg-muted/60 text-xs font-medium text-muted-foreground backdrop-blur">
                <button
                  type="button"
                  disabled={fija}
                  aria-expanded={!plegada}
                  onClick={() => alternar(s.id)}
                  className="flex w-full items-center gap-2 px-4 py-1.5 text-left enabled:hover:text-foreground md:px-6"
                >
                  {!fija && <ChevronRight className={cn("size-3.5 transition-transform", !plegada && "rotate-90")} aria-hidden />}
                  {s.id === "critico" && <span aria-hidden className="size-1.5 rounded-full bg-destructive" />}
                  {s.titulo}
                  <span className="tabular-nums">{s.filas.length}</span>
                </button>
              </h2>
              {fija && s.filas.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground md:px-6">Nada vence hoy.</p>}
              {!plegada && s.filas.length > 0 && (
                <ul className="divide-y">
                  {s.filas.map((f) => (
                    <Fila key={f.recId} f={f} conEmpresa={conEmpresa} hoy={hoy} abrir={() => setAbierta(f.recId)} actuar={(a) => actuar(f, a)} />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}

      <PendienteDetalle fila={detalle} abierto={Boolean(detalle)} alCerrar={cerrarDetalle} acciones={detalle && !soloLectura ? <AccionesDetalle f={detalle} hoy={hoy} actuar={(a) => actuar(detalle, a)} /> : undefined} />
    </>
  );
}

"use client";

import { CalendarClock, Check, MoreHorizontal, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AccionesModulo } from "@/components/shell/barra-superior";
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
          {dx > 0 ? "Cerrar" : "Aplazar a mañana"}
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
                aria-label={`Cerrar: ${f.asunto ?? ""}`}
                className="flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-transparent transition-colors hover:border-acento hover:bg-acento hover:text-acento-foreground focus-visible:text-acento-foreground"
              >
                <Check className="size-3" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>Cerrar</TooltipContent>
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
        {activo && (
          <span className="hidden shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => actuar({ tipo: "aplazar", hasta: sumarDias(hoy, 1) })} aria-label="Aplazar a mañana">
                  <CalendarClock className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aplazar a mañana</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => actuar({ tipo: "descartar" })} aria-label="Descartar">
                  <X className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Descartar</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Más acciones">
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => actuar({ tipo: "aplazar", hasta: lunes(hoy) })}>Aplazar al lunes</DropdownMenuItem>
                <DropdownMenuItem onSelect={abrir}>Abrir el detalle</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}
      </div>
    </li>
  );
}

function AccionesDetalle({ f, hoy, actuar }: { f: FilaVista; hoy: string; actuar: (a: Accion) => void }) {
  const [fecha, setFecha] = useState(sumarDias(hoy, 1));
  if (!f.puedeEditar) return <p className="text-sm text-muted-foreground">Solo lectura: tu acceso no edita este pendiente.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button className="bg-acento text-acento-foreground hover:bg-acento/90" onClick={() => actuar({ tipo: "cerrar" })}>
          <Check className="size-4" aria-hidden /> Cerrar
        </Button>
        <Button variant="outline" onClick={() => actuar({ tipo: "aplazar", hasta: sumarDias(hoy, 1) })}>
          Mañana
        </Button>
        <Button variant="outline" onClick={() => actuar({ tipo: "aplazar", hasta: lunes(hoy) })}>
          Lunes
        </Button>
        <Button variant="ghost" onClick={() => actuar({ tipo: "descartar" })}>
          Descartar
        </Button>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="aplazar-hasta" className="text-muted-foreground">
          Aplazar hasta
        </label>
        <Input id="aplazar-hasta" type="date" min={sumarDias(hoy, 1)} value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-8 w-auto" />
        <Button size="sm" variant="outline" onClick={() => actuar({ tipo: "aplazar", hasta: fecha })}>
          Aplazar
        </Button>
      </div>
    </div>
  );
}

/** Hoy: lista agrupada por Crítico, Vencido, Hoy y Esta semana, con acciones al pasar el mouse. */
export function ListaHoy({ secciones, hoy, conEmpresa, ejecutar, soloLectura }: { secciones: SeccionVista[]; hoy: string; conEmpresa: boolean; ejecutar: Ejecutar; soloLectura?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { abrirAsistente, asistenteHabilitado } = useShell();
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set());
  const [texto, setTexto] = useState("");
  const [responsable, setResponsable] = useState("todos");
  // ?fila= abre el detalle (lo usa ⌘K); si cambia estando en la pantalla, se vuelve a abrir.
  const filaUrl = params.get("fila");
  const [abierta, setAbierta] = useState<string | null>(filaUrl);
  const [filaVista, setFilaVista] = useState(filaUrl);
  if (filaUrl !== filaVista) {
    setFilaVista(filaUrl);
    setAbierta(filaUrl);
  }

  const responsables = useMemo(() => [...new Set(secciones.flatMap((s) => s.filas.map((f) => f.responsable).filter(Boolean) as string[]))].sort(), [secciones]);
  const filtrar = (f: FilaVista) =>
    !quitadas.has(f.recId) &&
    (responsable === "todos" || f.responsable === responsable) &&
    (!texto || `${f.asunto} ${f.accion} ${f.numero} ${f.proceso}`.toLowerCase().includes(texto.toLowerCase()));
  const visibles = secciones.map((s) => ({ ...s, filas: s.filas.filter(filtrar) }));
  const total = visibles.reduce((n, s) => n + s.filas.length, 0);
  const todas = secciones.flatMap((s) => s.filas);
  const detalle = todas.find((f) => f.recId === abierta) ?? null;

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
      <AccionesModulo>
        <div className="relative max-md:hidden">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Filtrar" aria-label="Filtrar pendientes" className="h-8 w-44 pl-8" />
        </div>
        {responsables.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                {responsable === "todos" ? "Responsable" : responsable}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Responsable</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={responsable} onValueChange={setResponsable}>
                <DropdownMenuRadioItem value="todos">Todos</DropdownMenuRadioItem>
                {responsables.map((r) => (
                  <DropdownMenuRadioItem key={r} value={r}>
                    {r}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </AccionesModulo>

      {total === 0 ? (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-24 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Check className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <p className="font-medium">{texto || responsable !== "todos" ? "Nada con ese filtro" : "Nada pendiente para hoy"}</p>
          <p className="text-sm text-muted-foreground">
            {texto || responsable !== "todos" ? "Prueba con otra palabra o quita el filtro." : "Lo que venza esta semana aparecerá aquí."}
          </p>
          {texto || responsable !== "todos" ? (
            <Button variant="outline" size="sm" onClick={() => (setTexto(""), setResponsable("todos"))}>
              Quitar filtros
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
        visibles.map((s) =>
          s.filas.length === 0 ? null : (
            <section key={s.id} aria-labelledby={`sec-${s.id}`}>
              <h2 id={`sec-${s.id}`} className="sticky top-14 z-10 flex items-center gap-2 border-b bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur md:px-6">
                {s.id === "critico" && <span aria-hidden className="size-1.5 rounded-full bg-destructive" />}
                {s.titulo}
                <span className="tabular-nums">{s.filas.length}</span>
              </h2>
              <ul className="divide-y">
                {s.filas.map((f) => (
                  <Fila key={f.recId} f={f} conEmpresa={conEmpresa} hoy={hoy} abrir={() => setAbierta(f.recId)} actuar={(a) => actuar(f, a)} />
                ))}
              </ul>
            </section>
          ),
        )
      )}

      <PendienteDetalle fila={detalle} abierto={Boolean(detalle)} alCerrar={cerrarDetalle} acciones={detalle && !soloLectura ? <AccionesDetalle f={detalle} hoy={hoy} actuar={(a) => actuar(detalle, a)} /> : undefined} />
    </>
  );
}

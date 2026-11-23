"use client";

import { Bookmark, CalendarDays, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Columns3, List, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { borrarVista, guardarVista } from "@/app/modulos/vistas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Columna, FilaTabla, Indicador, TipoVista } from "@/lib/modulos/tabla";
import type { Periodo } from "@/lib/vistas/periodo";
import { cn } from "@/lib/utils";

export const PREFIJO_FILTRO = "f.";

/** Parámetros de la URL con un cambio; el período se conserva salvo que se cambie. */
export function useParametros() {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const cambiar = (cambios: Record<string, string | null>, modo: "push" | "replace" = "replace") => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const q = p.toString();
    router[modo](q ? `${ruta}?${q}` : ruta, { scroll: false });
  };
  return { params, cambiar, ruta };
}

/** ‹ noviembre 2026 › con "Hoy" cuando no se está en el período actual. */
export function SelectorPeriodo({ periodo }: { periodo: Periodo }) {
  const { params, ruta } = useParametros();
  const href = (clave: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (clave) p.set("p", clave);
    else p.delete("p");
    const q = p.toString();
    return q ? `${ruta}?${q}` : ruta;
  };
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Período">
      <Button asChild variant="ghost" size="icon" className="size-8">
        <Link href={href(periodo.anterior)} aria-label="Período anterior" scroll={false}>
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      </Button>
      <span className="min-w-36 text-center text-sm font-medium first-letter:uppercase" aria-live="polite">
        {periodo.etiqueta}
      </span>
      <Button asChild variant="ghost" size="icon" className="size-8">
        <Link href={href(periodo.siguiente)} aria-label="Período siguiente" scroll={false}>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </Button>
      {!periodo.actual && (
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href={href(null)} scroll={false}>
            {periodo.unidad === "dia" ? "Hoy" : periodo.unidad === "semana" ? "Esta semana" : "Este mes"}
          </Link>
        </Button>
      )}
    </div>
  );
}

/** Filtros activos desde la URL: { campo: valor }. */
export function filtrosDeUrl(params: URLSearchParams, campos: string[]): Record<string, string> {
  return Object.fromEntries(campos.map((c) => [c, params.get(`${PREFIJO_FILTRO}${c}`) ?? ""]).filter(([, v]) => v));
}

export function aplicarFiltros(filas: FilaTabla[], activos: Record<string, string>): FilaTabla[] {
  const pares = Object.entries(activos);
  return pares.length ? filas.filter((f) => pares.every(([c, v]) => (f.celdas[c] ?? "") === (v === "(vacío)" ? "" : v))) : filas;
}

/** Un chip por filtro: "Edificio: Todos ▾" con los valores que hay en el período. */
export function Filtros({ campos, columnas, filas, activos }: { campos: string[]; columnas: Columna[]; filas: FilaTabla[]; activos: Record<string, string> }) {
  const { cambiar } = useParametros();
  const visibles = campos.filter((c) => columnas.some((x) => x.campo === c));
  if (!visibles.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros">
      {visibles.map((c) => {
        const col = columnas.find((x) => x.campo === c)!;
        const valores = [...new Set(filas.map((f) => f.celdas[c] ?? ""))].map((v) => v || "(vacío)").sort((a, b) => a.localeCompare(b, "es"));
        const activo = activos[c];
        return (
          <DropdownMenu key={c}>
            <DropdownMenuTrigger asChild>
              <Button variant={activo ? "secondary" : "outline"} size="sm" className="h-7 gap-1 rounded-full px-2.5 text-xs">
                <span className="text-muted-foreground">{col.etiqueta ?? c}:</span> {activo ?? "Todos"}
                <ChevronDown className="size-3" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
              <DropdownMenuCheckboxItem checked={!activo} onCheckedChange={() => cambiar({ [`${PREFIJO_FILTRO}${c}`]: null })}>
                Todos
              </DropdownMenuCheckboxItem>
              {valores.map((v) => (
                <DropdownMenuCheckboxItem key={v} checked={activo === v} onCheckedChange={() => cambiar({ [`${PREFIJO_FILTRO}${c}`]: v })}>
                  <span className="truncate">{v}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
      {Object.keys(activos).length > 0 && (
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => cambiar(Object.fromEntries(Object.keys(activos).map((c) => [`${PREFIJO_FILTRO}${c}`, null])))}>
          <X className="size-3" aria-hidden /> Quitar filtros
        </Button>
      )}
    </div>
  );
}

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
/** "$1.250.000", "12,5" o "8" → número. */
export const aNumero = (v: string) => {
  const limpio = v.replace(/[^\d,-]/g, "").replace(",", ".");
  const n = Number(limpio);
  return limpio && !Number.isNaN(n) ? n : 0;
};

/** Cifras del período sobre lo filtrado. Una suma de una columna que la persona no ve no aparece. */
export function Indicadores({ indicadores, columnas, filas }: { indicadores: Indicador[]; columnas: Columna[]; filas: FilaTabla[] }) {
  const items = indicadores
    .map((i) => {
      if (i.tipo === "conteo") {
        const n = i.donde ? filas.filter((f) => i.donde!.valores.includes(f.celdas[i.donde!.campo] ?? "")).length : filas.length;
        return { etiqueta: i.etiqueta, valor: numero.format(n) };
      }
      const col = columnas.find((c) => c.campo === i.campo);
      if (!col) return null;
      if (i.tipo === "distintos") return { etiqueta: i.etiqueta, valor: numero.format(new Set(filas.map((f) => f.celdas[i.campo]).filter(Boolean)).size) };
      const total = filas.reduce((s, f) => s + aNumero(f.celdas[i.campo] ?? ""), 0);
      return { etiqueta: i.etiqueta, valor: col.tipo === "dinero" ? pesos.format(total) : numero.format(total) };
    })
    .filter(Boolean) as { etiqueta: string; valor: string }[];
  if (!items.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Indicadores">
      {items.map((i) => (
        <div key={i.etiqueta} className="rounded-lg border bg-card px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">{i.etiqueta}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

const VISTAS = { lista: { nombre: "Lista", icono: List }, tablero: { nombre: "Tablero", icono: Columns3 }, calendario: { nombre: "Calendario", icono: CalendarDays }, agenda: { nombre: "Agenda", icono: CalendarRange } } as const;

/** Tipos de vista que el módulo tiene. La inicial no se escribe en la URL. */
export function SelectorVista({ vista, opciones, inicial }: { vista: TipoVista; opciones: TipoVista[]; inicial: TipoVista }) {
  const { cambiar } = useParametros();
  if (opciones.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Tipo de vista" className="flex rounded-md border p-0.5">
      {opciones.map((id) => {
        const o = VISTAS[id];
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={vista === id}
            onClick={() => cambiar({ v: id === inicial ? null : id })}
            className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-xs", vista === id ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            <o.icono className="size-3.5" aria-hidden /> {o.nombre}
          </button>
        );
      })}
    </div>
  );
}

/** Tablero: una columna por valor del campo (normalmente Estado). */
export function Tablero({ campo, columnas, filas, alAbrir }: { campo: string; columnas: Columna[]; filas: FilaTabla[]; alAbrir: (f: FilaTabla) => void }) {
  const grupos = useMemo(() => {
    const m = new Map<string, FilaTabla[]>();
    for (const f of filas) {
      const k = f.celdas[campo] || "Sin valor";
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filas, campo]);
  const [titulo, ...resto] = columnas;
  const secundarias = resto.filter((c) => c.campo !== campo).slice(0, 3);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2" aria-label={`Tablero por ${campo}`}>
      {grupos.map(([valor, items]) => (
        <section key={valor} aria-label={valor} className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/50 p-2">
          <h3 className="flex items-center justify-between px-1 pb-2 text-sm font-medium">
            {valor} <Badge variant="secondary">{items.length}</Badge>
          </h3>
          <ul className="space-y-2">
            {items.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => alAbrir(f)} className="w-full rounded-md border bg-card p-2.5 text-left text-sm hover:border-foreground/20">
                  <p className="truncate font-medium">{(titulo && f.celdas[titulo.campo]) || "—"}</p>
                  {secundarias.map((c) =>
                    f.celdas[c.campo] ? (
                      <p key={c.campo} className="truncate text-xs text-muted-foreground">
                        {c.etiqueta ?? c.campo}: {f.celdas[c.campo]}
                      </p>
                    ) : null,
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export interface VistaGuardada {
  id: string;
  nombre: string;
  parametros: Record<string, string>;
}

/** Vistas guardadas de la persona en este módulo, y la última vista usada (en este navegador). */
export function MenuVistas({ vistas }: { vistas: VistaGuardada[] }) {
  const router = useRouter();
  const { params, ruta } = useParametros();
  const [nombre, setNombre] = useState("");
  const [abierto, setAbierto] = useState(false);
  const actuales = useMemo(() => Object.fromEntries([...params.entries()].filter(([k]) => k !== "p")), [params]);
  const clave = `verse-app:vista:${ruta}`;

  // Volver a la última vista usada aquí si se entra sin parámetros.
  useEffect(() => {
    try {
      if ([...params.keys()].length === 0) {
        const guardada = window.localStorage.getItem(clave);
        if (guardada) router.replace(`${ruta}?${guardada}`, { scroll: false });
      }
    } catch {
      /* sin almacenamiento local: no pasa nada */
    }
    // Solo al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      const q = new URLSearchParams(actuales).toString();
      if (q) window.localStorage.setItem(clave, q);
      else window.localStorage.removeItem(clave);
    } catch {
      /* sin almacenamiento local */
    }
  }, [actuales, clave]);

  async function guardar() {
    const n = nombre.trim();
    if (!n) return;
    const r = await guardarVista(ruta, n, actuales);
    if (r.ok) {
      toast.success(`Vista "${n}" guardada`);
      setNombre("");
      setAbierto(false);
      router.refresh();
    } else toast.error(r.mensaje);
  }

  const abrir = (v: VistaGuardada) => {
    const p = new URLSearchParams(v.parametros);
    const periodo = params.get("p");
    if (periodo) p.set("p", periodo);
    const q = p.toString();
    router.replace(q ? `${ruta}?${q}` : ruta, { scroll: false });
  };

  return (
    <DropdownMenu open={abierto} onOpenChange={setAbierto}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs">
          <Bookmark className="size-3.5" aria-hidden /> Vistas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Tus vistas</DropdownMenuLabel>
        {vistas.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Todavía no guardas vistas aquí.</p>}
        {vistas.map((v) => (
          <DropdownMenuItem key={v.id} onSelect={() => abrir(v)} className="justify-between gap-2">
            <span className="truncate">{v.nombre}</span>
            <button
              type="button"
              aria-label={`Borrar vista ${v.nombre}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={async (e) => {
                e.stopPropagation();
                await borrarVista(v.id);
                router.refresh();
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <form
          className="flex gap-1 p-1"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de esta vista" aria-label="Nombre de la vista" className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs" maxLength={60} />
          <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={!nombre.trim()}>
            Guardar
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

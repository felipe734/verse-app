"use client";

import { ArrowDown, ArrowUp, Check, EyeOff, Search, Sparkles, Table2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cambiarRapido } from "@/app/modulos/editar";
import { useMemo, useState } from "react";
import { AccionesModulo } from "@/components/shell/barra-superior";
import { useShell } from "@/components/shell/contexto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Columna, DefAgenda, DefCalendario, FilaTabla, Indicador, TipoVista } from "@/lib/modulos/tabla";
import type { Periodo } from "@/lib/vistas/periodo";
import { cn } from "@/lib/utils";
import type { RefModulo } from "@/app/modulos/editar";
import { esMio } from "@/lib/vistas/mio";
import { Actualizar, aplicarFiltros, Filtros, InterruptorMio, filtrosDeUrl, Indicadores, MenuVistas, SelectorPeriodo, SelectorVista, Tablero, type VistaGuardada } from "./controles";
import { Agenda, Calendario } from "./calendario";
import { Edicion } from "./edicion";

const derecha = (c: Columna) => c.tipo === "dinero" || c.tipo === "numero";
const etiqueta = (c: Columna) => c.etiqueta ?? c.campo;
/** "$1.250.000" o "12" → número para ordenar; si no, texto. */
const clave = (v: string) => {
  const n = Number(v.replace(/[$\s.]/g, "").replace(",", "."));
  if (v && !Number.isNaN(n) && /^[$\d\s.,-]+$/.test(v)) return n;
  const f = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (f) return Number(`${f[3]}${f[2]!.padStart(2, "0")}${f[1]!.padStart(2, "0")}`);
  return v.toLowerCase();
};

/** Lista densa de una tabla: filtro, orden por columna y detalle en panel lateral. */
export function VistaTabla({
  titulo,
  modulo,
  columnas,
  detalle,
  filas,
  ocultos,
  vacio,
  error,
  edicion,
  periodo,
  filtros = [],
  tablero,
  indicadores = [],
  vistas,
  calendario,
  agenda,
  vistaInicial = "lista",
  hoy,
  persona,
  tablas,
  rapidas = [],
  campoTablero,
}: {
  titulo: string;
  modulo: string;
  columnas: Columna[];
  detalle: Columna[];
  filas: FilaTabla[];
  ocultos: string[];
  vacio?: string;
  error?: string;
  /** Si la persona puede editar en este módulo: dónde está, para la acción del servidor. */
  edicion?: RefModulo;
  /** Período de la vista (selector ‹ ›). */
  periodo?: Periodo;
  /** Columnas filtrables con chips. */
  filtros?: string[];
  /** Columna que arma el tablero. */
  tablero?: string;
  indicadores?: Indicador[];
  /** Vistas guardadas de la persona; sin esto no se muestra el menú. */
  vistas?: VistaGuardada[];
  calendario?: DefCalendario;
  agenda?: DefAgenda;
  vistaInicial?: TipoVista;
  /** AAAA-MM-DD de Bogotá, para marcar hoy en calendario y agenda. */
  hoy?: string;
  /** Interruptor Mío / Todo: la columna de persona, el nombre de quien entra y si abre en Mío. */
  persona?: { campo: string; nombre: string; porDefecto: boolean };
  /** IDs de las tablas de Airtable que lee el módulo, para el botón Actualizar. */
  tablas?: string[];
  /** Acciones de un toque (solo si la persona edita el módulo). */
  rapidas?: { etiqueta: string; campo: string; valor: string; columna: string }[];
  /** Campo editable del tablero: mover tarjetas lo cambia. */
  campoTablero?: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  async function rapido(f: FilaTabla, campo: string, valor: string, columna: string, etiquetaOk: string) {
    if (!edicion) return;
    setOcupado(f.id);
    const r = await cambiarRapido(edicion, f.id, campo, valor, f.celdas[columna] ?? "");
    setOcupado(null);
    if (r.ok) {
      toast.success(`${etiquetaOk}: ${f.celdas[columnas[0]?.campo ?? ""] ?? ""}`);
      setAbierta(null);
      router.refresh();
    } else toast.error(r.mensaje);
  }
  const aplicables = (f: FilaTabla) => (edicion ? rapidas.filter((a) => (f.celdas[a.columna] ?? "") !== a.valor) : []);
  const { abrirAsistente, asistenteHabilitado } = useShell();
  const params = useSearchParams();
  const activos = useMemo(() => filtrosDeUrl(new URLSearchParams(params.toString()), filtros), [params, filtros]);
  const tableroVisible = tablero && columnas.some((c) => c.campo === tablero) ? tablero : undefined;
  const opciones: TipoVista[] = [
    ...(calendario && periodo ? (["calendario"] as const) : []),
    ...(agenda && periodo ? (["agenda"] as const) : []),
    "lista",
    ...(tableroVisible ? (["tablero"] as const) : []),
  ];
  const pedida = (params.get("v") as TipoVista | null) ?? vistaInicial;
  const vista: TipoVista = opciones.includes(pedida) ? pedida : "lista";
  const personaVisible = persona && columnas.some((c) => c.campo === persona.campo) ? persona : undefined;
  const quien = params.get("quien");
  const mio = personaVisible ? (quien ? quien === "mio" : personaVisible.porDefecto) : false;
  const propias = useMemo(() => (mio && personaVisible ? filas.filter((f) => esMio(f.celdas[personaVisible.campo], personaVisible.nombre)) : filas), [filas, mio, personaVisible]);
  const filtradas = useMemo(() => aplicarFiltros(propias, activos), [propias, activos]);
  const [texto, setTexto] = useState("");
  const [orden, setOrden] = useState<{ campo: string; desc: boolean } | null>(null);
  const [abierta, setAbierta] = useState<FilaTabla | null>(null);

  const visibles = useMemo(() => {
    const t = texto.toLowerCase();
    const lista = t ? filtradas.filter((f) => Object.values(f.celdas).some((v) => v.toLowerCase().includes(t))) : filtradas;
    if (!orden) return lista;
    return [...lista].sort((a, b) => {
      const x = clave(a.celdas[orden.campo] ?? "");
      const y = clave(b.celdas[orden.campo] ?? "");
      const r = x < y ? -1 : x > y ? 1 : 0;
      return orden.desc ? -r : r;
    });
  }, [filtradas, texto, orden]);

  const ordenar = (campo: string) => setOrden((o) => (o?.campo === campo ? (o.desc ? null : { campo, desc: true }) : { campo, desc: false }));

  return (
    <>
      <AccionesModulo>
        <div className="relative max-md:hidden">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Filtrar" aria-label={`Filtrar ${modulo}`} className="h-8 w-48 pl-8" />
        </div>
      </AccionesModulo>
      <div className="px-4 pb-10 md:px-6">
        {(periodo || opciones.length > 1 || vistas || personaVisible || tablas) && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {periodo ? <SelectorPeriodo periodo={periodo} /> : <span />}
            <div className="flex flex-wrap items-center gap-2">
              {tablas && <Actualizar tablas={tablas} />}
              {personaVisible && <InterruptorMio mio={mio} porDefecto={personaVisible.porDefecto} />}
              <SelectorVista vista={vista} opciones={opciones} inicial={opciones.includes(vistaInicial) ? vistaInicial : "lista"} />
              {vistas && <MenuVistas vistas={vistas} />}
            </div>
          </div>
        )}
        {filtros.length > 0 && !error && (
          <div className="mb-3">
            <Filtros campos={filtros} columnas={columnas} filas={propias} activos={activos} />
          </div>
        )}
        {indicadores.length > 0 && !error && (
          <div className="mb-4">
            <Indicadores indicadores={indicadores} columnas={columnas} filas={visibles} />
          </div>
        )}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {visibles.length} {visibles.length === 1 ? "fila" : "filas"}
          </span>
          {ocultos.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <EyeOff className="size-3.5" aria-hidden /> Tu acceso no incluye {ocultos.join(", ")}.
            </span>
          )}
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Filtrar" aria-label={`Filtrar ${modulo}`} className="h-8 md:hidden" />
        </div>
        {error ? (
          <p role="alert" className="rounded-md border px-3 py-6 text-center text-sm">
            {error}
          </p>
        ) : visibles.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-20 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Table2 className="size-5 text-muted-foreground" aria-hidden />
            </span>
            <p className="font-medium">{texto ? "Nada con ese filtro" : (vacio ?? "No hay filas por ahora")}</p>
            {texto && (
              <Button variant="outline" size="sm" onClick={() => setTexto("")}>
                Quitar filtro
              </Button>
            )}
          </div>
        ) : vista === "calendario" && calendario && periodo ? (
          <Calendario def={calendario} filas={visibles} periodo={periodo} hoy={hoy ?? periodo.inicio} alAbrir={setAbierta} />
        ) : vista === "agenda" && agenda && periodo ? (
          <Agenda
            def={agenda}
            filas={visibles}
            periodo={periodo}
            hoy={hoy ?? periodo.inicio}
            alAbrir={setAbierta}
            accion={(f) => {
              const a = aplicables(f)[0];
              return a ? (
                <button
                  type="button"
                  aria-label={`${a.etiqueta}: ${f.celdas[agenda.titulo] ?? ""}`}
                  title={a.etiqueta}
                  disabled={ocupado === f.id}
                  onClick={() => void rapido(f, a.campo, a.valor, a.columna, a.etiqueta)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Check className="size-3.5" aria-hidden />
                </button>
              ) : null;
            }}
          />
        ) : vista === "tablero" && tableroVisible ? (
          <Tablero
            campo={tableroVisible}
            columnas={columnas}
            filas={visibles}
            alAbrir={setAbierta}
            alMover={edicion && campoTablero ? (f, valor) => void rapido(f, campoTablero, valor, tableroVisible, valor) : undefined}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {columnas.map((c, i) => (
                    <TableHead key={c.campo} className={cn(i === 0 && "pl-4", i === columnas.length - 1 && "pr-4", derecha(c) && "text-right", i > 2 && "max-md:hidden")}>
                      <button type="button" onClick={() => ordenar(c.campo)} className="inline-flex items-center gap-1 hover:text-foreground">
                        {etiqueta(c)}
                        {orden?.campo === c.campo && (orden.desc ? <ArrowDown className="size-3" aria-label="descendente" /> : <ArrowUp className="size-3" aria-label="ascendente" />)}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((f) => (
                  <TableRow key={f.id} className="cursor-pointer" onClick={() => setAbierta(f)}>
                    {columnas.map((c, i) => {
                      const v = f.celdas[c.campo] ?? "";
                      return (
                        <TableCell
                          key={c.campo}
                          className={cn(i === 0 && "pl-4 font-medium", i === columnas.length - 1 && "pr-4", derecha(c) && "text-right tabular-nums", i > 2 && "max-md:hidden", "max-w-[240px] truncate")}
                        >
                          {i === 0 ? (
                            <button type="button" className="text-left outline-none" onClick={() => setAbierta(f)}>
                              {v || "—"}
                            </button>
                          ) : c.tipo === "estado" && v ? (
                            <Badge variant="secondary">{v}</Badge>
                          ) : (
                            v || <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Sheet open={Boolean(abierta)} onOpenChange={(v) => !v && setAbierta(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md" data-seleccion={abierta ? `${titulo} ${abierta.celdas[columnas[0]?.campo ?? ""] ?? ""} (${modulo})` : undefined}>
          {abierta && (
            <>
              <SheetHeader className="border-b">
                <SheetDescription>{modulo}</SheetDescription>
                <SheetTitle className="text-base">{abierta.celdas[columnas[0]?.campo ?? ""] || "—"}</SheetTitle>
              </SheetHeader>
              <dl className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
                {[...columnas.slice(1), ...detalle].map((c) => (
                  <div key={c.campo} className="grid grid-cols-[130px_1fr] gap-3">
                    <dt className="text-muted-foreground">{etiqueta(c)}</dt>
                    <dd className="whitespace-pre-line break-words">{abierta.celdas[c.campo] || "—"}</dd>
                  </div>
                ))}
              </dl>
              {aplicables(abierta).length > 0 && (
                <div className="flex flex-wrap gap-2 border-t p-4">
                  {aplicables(abierta).map((a) => (
                    <Button key={a.etiqueta} size="sm" className="gap-1.5" disabled={ocupado === abierta.id} onClick={() => void rapido(abierta, a.campo, a.valor, a.columna, a.etiqueta)}>
                      <Check className="size-4" aria-hidden /> {a.etiqueta}
                    </Button>
                  ))}
                </div>
              )}
              {edicion && (
                <div className="border-t p-4">
                  <Edicion key={abierta.id} refModulo={edicion} recId={abierta.id} alGuardar={() => setAbierta(null)} />
                </div>
              )}
              {asistenteHabilitado && (
                <div className="border-t p-4">
                  <Button variant="ghost" className="gap-2" onClick={() => abrirAsistente(`Sobre ${abierta.celdas[columnas[0]?.campo ?? ""]} en ${modulo}: `)}>
                    <Sparkles className="size-4" aria-hidden /> Preguntar al asistente
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

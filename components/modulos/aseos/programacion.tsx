"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cambiarAccion, leerProgramacion, programarAccion } from "@/app/modulos/aseos";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Aseo, Programacion } from "@/lib/aseos/programacion";
import { cn } from "@/lib/utils";

const caja = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const diaCorto = (f: string, hoy: string) => {
  if (f === hoy) return "Hoy";
  const d = new Date(`${f}T12:00:00Z`);
  const manana = new Date(`${hoy}T12:00:00Z`);
  manana.setUTCDate(manana.getUTCDate() + 1);
  if (d.getTime() === manana.getTime()) return "Mañana";
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}`;
};
const hora12 = (h: string) => {
  if (!h) return "";
  const [a, m] = h.split(":").map(Number) as [number, number];
  return `${a % 12 || 12}:${String(m).padStart(2, "0")} ${a < 12 ? "a. m." : "p. m."}`;
};

type Formulario = { tipo: "nuevo"; unidad: string; fecha: string; hora: string; funcionaria: string; comentario: string } | { tipo: "cambio"; aseo: Aseo; fecha: string; hora: string; funcionaria: string };

/** Programación de aseos de la semana: lo que falta programar, quién hace cada aseo y a qué hora. */
export function ProgramacionAseos({ abrirAlInicio }: { abrirAlInicio?: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(Boolean(abrirAlInicio));
  const [datos, setDatos] = useState<Programacion | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const traer = () =>
    leerProgramacion().then((r) => {
      if ("error" in r) {
        toast.error(r.error);
        return setAbierto(false);
      }
      setDatos(r);
    });

  function cargar() {
    setDatos(null);
    void traer();
  }

  function abrir() {
    setAbierto(true);
    setForm(null);
    cargar();
  }

  // Llegó con ?programar=1 (desde la alerta de salidas sin aseo): abre ya cargando.
  useEffect(() => {
    if (!abrirAlInicio) return;
    leerProgramacion().then((r) => {
      if ("error" in r) {
        toast.error(r.error);
        return setAbierto(false);
      }
      setDatos(r);
    });
  }, [abrirAlInicio]);

  const funcionariaId = (nombre: string) => datos?.funcionarias.find((f) => nombre && f.nombre === nombre)?.recId ?? "";

  async function guardar() {
    if (!form) return;
    setOcupado(true);
    const r =
      form.tipo === "nuevo"
        ? await programarAccion({ unidad: form.unidad, fecha: form.fecha, hora: form.hora, funcionaria: form.funcionaria, comentario: form.comentario })
        : await cambiarAccion({
            recId: form.aseo.recId,
            ...(form.funcionaria !== funcionariaId(form.aseo.funcionaria) ? { funcionaria: form.funcionaria } : {}),
            ...(form.fecha !== form.aseo.fecha || form.hora !== form.aseo.hora ? { fecha: form.fecha, hora: form.hora } : {}),
          });
    setOcupado(false);
    if (!r.ok) return void toast.error(r.mensaje);
    toast.success(r.mensaje);
    setForm(null);
    router.refresh();
    cargar();
  }

  const porDia = new Map<string, Aseo[]>();
  for (const a of datos?.aseos ?? []) porDia.set(a.fecha, [...(porDia.get(a.fecha) ?? []), a]);
  const sinAseadora = datos?.aseos.filter((a) => !a.funcionaria && !a.terminado).length ?? 0;

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={abrir}>
        <CalendarPlus className="size-4" aria-hidden /> Programación
      </Button>
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>{form ? (form.tipo === "nuevo" ? "Nuevo aseo" : form.aseo.unidad) : "Programación de aseos"}</SheetTitle>
            <SheetDescription>{form ? "Queda en Airtable y en la actividad con tu nombre." : "Próximos 7 días"}</SheetDescription>
          </SheetHeader>

          {!datos ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando
            </p>
          ) : form ? (
            <form
              aria-label="Aseo"
              className="flex-1 space-y-3 overflow-y-auto p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void guardar();
              }}
            >
              <button type="button" onClick={() => setForm(null)} className="-ml-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronLeft className="size-4" aria-hidden /> Volver
              </button>
              {form.tipo === "nuevo" && (
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Unidad</span>
                  <select className={caja} required value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                    <option value="">Elige</option>
                    {datos.unidades.map((u) => (
                      <option key={u.recId} value={u.recId}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Fecha</span>
                  <input className={caja} type="date" required min={datos.hoy} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Hora</span>
                  <input className={caja} type="time" required step={900} value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
                </label>
              </div>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Aseadora</span>
                <select className={caja} value={form.funcionaria} onChange={(e) => setForm({ ...form, funcionaria: e.target.value })}>
                  <option value="">Sin asignar</option>
                  {datos.funcionarias.map((f) => (
                    <option key={f.recId} value={f.recId}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
              </label>
              {form.tipo === "nuevo" && (
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Comentario</span>
                  <textarea className={cn(caja, "min-h-20")} value={form.comentario} onChange={(e) => setForm({ ...form, comentario: e.target.value })} placeholder="Salida de huésped, alistamiento…" />
                </label>
              )}
              {form.tipo === "nuevo" && <p className="text-xs text-muted-foreground">Queda Programado, con el valor de limpieza de la unidad y el pago Pendiente.</p>}
              <Button type="submit" className="w-full" disabled={ocupado}>
                {ocupado && <Loader2 className="size-4 animate-spin" aria-hidden />} {form.tipo === "nuevo" ? "Programar" : "Guardar"}
              </Button>
            </form>
          ) : (
            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              <Button variant="outline" className="w-full gap-1.5" onClick={() => setForm({ tipo: "nuevo", unidad: "", fecha: datos.hoy, hora: "11:00", funcionaria: "", comentario: "" })}>
                <Plus className="size-4" aria-hidden /> Nuevo aseo
              </Button>

              <section aria-label="Salidas sin aseo" className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Salidas sin aseo <span className={cn("tabular-nums", datos.porProgramar.length ? "text-destructive" : "text-muted-foreground")}>{datos.porProgramar.length}</span>
                </h3>
                {datos.porProgramar.length ? (
                  <ul className="space-y-1.5">
                    {datos.porProgramar.map((p) => (
                      <li key={`${p.unidad}|${p.fecha}`} className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                        <span className="w-16 shrink-0 text-muted-foreground">{diaCorto(p.fecha, datos.hoy)}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{p.unidad}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!p.unidadRecId}
                          title={p.unidadRecId ? undefined : "La unidad no está activa en UNIDADES"}
                          onClick={() => setForm({ tipo: "nuevo", unidad: p.unidadRecId ?? "", fecha: p.fecha, hora: "11:00", funcionaria: "", comentario: "Salida de huésped" })}
                        >
                          Programar
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Todas las salidas de la semana tienen aseo.</p>
                )}
              </section>

              <section aria-label="Aseos de la semana" className="space-y-3">
                <h3 className="text-sm font-semibold">
                  Aseos de la semana <span className="text-muted-foreground tabular-nums">{datos.aseos.length}</span>
                  {sinAseadora > 0 && <span className="ml-2 font-normal text-destructive">{sinAseadora} sin aseadora</span>}
                </h3>
                {[...porDia.entries()].map(([fecha, lista]) => (
                  <div key={fecha} className="space-y-1.5">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{diaCorto(fecha, datos.hoy)}</p>
                    <ul className="space-y-1.5">
                      {lista.map((a) => (
                        <li key={a.recId}>
                          <button
                            type="button"
                            disabled={a.terminado}
                            onClick={() => setForm({ tipo: "cambio", aseo: a, fecha: a.fecha, hora: a.hora || "11:00", funcionaria: funcionariaId(a.funcionaria) })}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left text-sm hover:border-foreground/20 disabled:opacity-60",
                              !a.funcionaria && !a.terminado && "border-destructive/30",
                            )}
                          >
                            <span className="w-[4.75rem] shrink-0 text-muted-foreground tabular-nums whitespace-nowrap">{hora12(a.hora)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{a.unidad}</span>
                              <span className={cn("block truncate text-xs", a.funcionaria ? "text-muted-foreground" : "text-destructive")}>
                                {a.terminado ? `Terminado · ${a.funcionaria}` : a.funcionaria || "Sin aseadora"}
                              </span>
                            </span>
                            {!a.terminado && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {!datos.aseos.length && <p className="text-sm text-muted-foreground">No hay aseos esta semana.</p>}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

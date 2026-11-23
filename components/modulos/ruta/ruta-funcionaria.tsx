"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { Check, Clock, KeyRound, Loader2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { cerrarTurnoAccion, datosIngresoAccion, iniciarTurnoAccion, reportarAccion } from "@/app/modulos/ruta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DatosIngreso, Parada, Turno } from "@/lib/ruta/ruta";
import { cn } from "@/lib/utils";
import { borrarPendiente, esErrorDeRed, guardarPendiente, listarPendientes, type Pendiente } from "./cola-local";

type Resultado = { ok: boolean; mensaje: string };

/** Envía una acción guardada: sube el video si hay y llama al servidor con la hora del toque. */
async function enviarPendiente(p: Pendiente, alAvance?: (n: number) => void): Promise<Resultado> {
  if (p.tipo === "iniciar") return iniciarTurnoAccion(p.cuando);
  if (p.tipo === "cerrar") return cerrarTurnoAccion(p.cuando);
  let video: { ruta: string; nombre: string } | undefined;
  if (p.archivo && p.nombreArchivo) {
    const b = await uploadPresigned(`servicios/${String(p.datos?.limpieza)}-${p.nombreArchivo.replace(/[^\w.-]/g, "_")}`, p.archivo, {
      access: "private",
      handleUploadUrl: "/api/ruta/video",
      multipart: p.archivo.size > 50 * 1024 * 1024,
      onUploadProgress: (x) => alAvance?.(Math.round(x.percentage)),
    });
    video = { ruta: b.pathname, nombre: p.nombreArchivo };
  }
  return reportarAccion({ ...p.datos, video }, p.cuando);
}

/** Intenta enviar; sin señal la deja guardada en el celular. Devuelve null si quedó guardada. */
async function enviarOGuardar(p: Pendiente, alAvance?: (n: number) => void): Promise<Resultado | null> {
  if (!navigator.onLine) {
    await guardarPendiente(p);
    return null;
  }
  try {
    return await enviarPendiente(p, alAvance);
  } catch (e) {
    if (!esErrorDeRed(e)) throw e;
    await guardarPendiente(p);
    return null;
  }
}

const nuevoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const caja = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Opciones<T extends string>({ valor, opciones, onCambio, etiqueta }: { valor: T; opciones: [T, string][]; onCambio: (v: T) => void; etiqueta: string }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      {opciones.map(([v, t]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          onClick={() => onCambio(v)}
          className={cn("rounded-md px-2 py-1.5 text-sm", valor === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Reporte({ parada, video, alCerrar, alGuardarLocal }: { parada: Parada; video: boolean; alCerrar: () => void; alGuardarLocal: () => void }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"Inventario de Entrega" | "Inventario de Recibido">("Inventario de Entrega");
  const [estado, setEstado] = useState<"Listo para entregar" | "Actividades pendientes">("Listo para entregar");
  const [danos, setDanos] = useState("");
  const [comentario, setComentario] = useState("");
  const [faltan, setFaltan] = useState(false);
  const [implementos, setImplementos] = useState("");
  const [lavanderia, setLavanderia] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [avance, setAvance] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    const pendiente: Pendiente = {
      id: nuevoId(),
      tipo: "reporte",
      cuando: new Date().toISOString(),
      datos: { limpieza: parada.recId, tipo, estado, danos, comentario, necesitaImplementos: faltan, implementos: faltan ? implementos : undefined, lavanderia },
      ...(archivo ? { archivo, nombreArchivo: archivo.name } : {}),
    };
    let r: Resultado | null;
    try {
      if (archivo) setAvance(0);
      r = await enviarOGuardar(pendiente, setAvance);
    } catch {
      setEnviando(false);
      setAvance(null);
      toast.error("El reporte no se pudo enviar. Intenta otra vez");
      return;
    }
    setEnviando(false);
    setAvance(null);
    if (r === null) {
      toast.success("Sin señal: el reporte quedó guardado en el celular y se envía al volver la conexión");
      alGuardarLocal();
      alCerrar();
      return;
    }
    if (r.ok) {
      toast.success(r.mensaje);
      alCerrar();
      router.refresh();
    } else toast.error(r.mensaje);
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Reporte de {parada.unidad}</SheetTitle>
        <SheetDescription>{parada.hora ? `Limpieza de las ${parada.hora}` : "Limpieza de hoy"}</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 overflow-y-auto px-4">
        <Opciones etiqueta="Tipo de inventario" valor={tipo} onCambio={setTipo} opciones={[["Inventario de Entrega", "Entrega"], ["Inventario de Recibido", "Recibido"]]} />
        <Opciones etiqueta="Estado de la unidad" valor={estado} onCambio={setEstado} opciones={[["Listo para entregar", "Lista"], ["Actividades pendientes", "Con pendientes"]]} />
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Video del recorrido</span>
          {video ? (
            <input type="file" accept="video/*" capture="environment" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5" />
          ) : (
            <span className="block text-muted-foreground">El video todavía no está activado. Envía el reporte sin video.</span>
          )}
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Daños o faltantes</span>
          <textarea value={danos} onChange={(e) => setDanos(e.target.value)} rows={3} className={caja} placeholder="Qué está dañado o qué falta" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={faltan} onChange={(e) => setFaltan(e.target.checked)} className="size-4" />
          Se necesitan implementos para el próximo servicio
        </label>
        {faltan && (
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Implementos a comprar</span>
            <textarea value={implementos} onChange={(e) => setImplementos(e.target.value)} rows={2} className={caja} />
          </label>
        )}
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Lavandería</span>
          <textarea value={lavanderia} onChange={(e) => setLavanderia(e.target.value)} rows={2} className={caja} placeholder="Qué sale a lavandería" />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Comentario</span>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} className={caja} />
        </label>
      </div>
      <SheetFooter>
        <Button onClick={enviar} disabled={enviando} className="w-full">
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {avance !== null ? `Subiendo video ${avance}%` : enviando ? "Enviando" : "Enviar reporte"}
        </Button>
      </SheetFooter>
    </>
  );
}

function Ingreso({ datos }: { datos: DatosIngreso }) {
  const filas: [string, string][] = [
    ["Método", datos.metodo],
    ["Código", datos.codigo],
    ["Candado", datos.candado],
    ["Red wifi", datos.wifiRed],
    ["Clave wifi", datos.wifiClave],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 text-sm">
      {filas
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium break-all">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

/** Lo que ve la funcionaria: su turno, sus paradas de hoy, los datos de ingreso y el reporte. */
export function RutaFuncionaria({ paradas, turno, codigos, video }: { paradas: Parada[]; turno: Turno | null; codigos: "nunca" | "turno" | "siempre"; video: boolean }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [abierta, setAbierta] = useState<{ parada: Parada; modo: "reporte" | "ingreso" } | null>(null);
  const [datos, setDatos] = useState<DatosIngreso | null>(null);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const hechas = paradas.filter((p) => p.terminada).length;
  const [porEnviar, setPorEnviar] = useState(0);
  const [turnoLocal, setTurnoLocal] = useState<"abierto" | "cerrado" | null>(null);

  const contar = useCallback(async () => setPorEnviar((await listarPendientes()).length), []);

  /** Envía lo guardado sin señal, en orden. Se detiene en el primer error de red. */
  const vaciar = useCallback(async () => {
    const lista = await listarPendientes();
    if (!lista.length || !navigator.onLine) return void setPorEnviar(lista.length);
    let enviados = 0;
    for (const p of lista) {
      try {
        const r = await enviarPendiente(p);
        await borrarPendiente(p.id);
        enviados++;
        if (!r.ok) toast.error(`No se aplicó algo guardado sin señal: ${r.mensaje}`);
      } catch (e) {
        if (esErrorDeRed(e)) break;
        await borrarPendiente(p.id);
      }
    }
    await contar();
    if (enviados) {
      toast.success(enviados === 1 ? "Se envió lo que guardaste sin señal" : `Se enviaron ${enviados} cosas guardadas sin señal`);
      setTurnoLocal(null);
      router.refresh();
    }
  }, [contar, router]);

  useEffect(() => {
    // Al abrir la ruta, intenta enviar lo guardado sin señal (fuera del render).
    const t = setTimeout(() => void vaciar(), 0);
    const alVolver = () => void vaciar();
    window.addEventListener("online", alVolver);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", alVolver);
    };
  }, [vaciar]);

  const turnoAccion = (tipo: "iniciar" | "cerrar") =>
    empezar(async () => {
      const r = await enviarOGuardar({ id: nuevoId(), tipo, cuando: new Date().toISOString() }).catch(() => ({ ok: false, mensaje: "No se pudo. Intenta otra vez" }));
      if (r === null) {
        toast.success(tipo === "iniciar" ? "Sin señal: el turno quedó iniciado en el celular y se envía al volver la conexión" : "Sin señal: el cierre quedó guardado y se envía al volver la conexión");
        setTurnoLocal(tipo === "iniciar" ? "abierto" : "cerrado");
        await contar();
      } else if (r.ok) {
        toast.success(r.mensaje);
        router.refresh();
      } else toast.error(r.mensaje);
      setConfirmarCierre(false);
    });
  const turnoVisible = turnoLocal === "abierto" ? (turno ?? { recId: "local", ingreso: "ahora (sin enviar)" }) : turnoLocal === "cerrado" ? null : turno;

  async function verIngreso(p: Parada) {
    setDatos(null);
    setAbierta({ parada: p, modo: "ingreso" });
    const r = await datosIngresoAccion(p.recId);
    if ("error" in r) {
      toast.error(r.error);
      setAbierta(null);
    } else setDatos(r);
  }

  const veCodigos = codigos === "siempre" || (codigos === "turno" && turnoVisible);

  return (
    <div className="space-y-4 px-4 pb-10 md:px-6">
      {porEnviar > 0 && (
        <p role="status" className="rounded-lg border border-dashed px-3 py-2 text-sm">
          {porEnviar === 1 ? "1 cosa guardada sin señal" : `${porEnviar} cosas guardadas sin señal`}: se envían solas cuando vuelva la conexión.
        </p>
      )}
      <section aria-label="Turno" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className={cn("size-4", turnoVisible ? "text-acento" : "text-muted-foreground")} aria-hidden />
          {turnoVisible ? <span>Turno abierto desde las {turnoVisible.ingreso}</span> : <span className="text-muted-foreground">Sin turno abierto</span>}
        </div>
        {turnoVisible ? (
          confirmarCierre ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmarCierre(false)}>
                No
              </Button>
              <Button size="sm" disabled={pendiente} onClick={() => turnoAccion("cerrar")}>
                Sí, cerrar turno
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmarCierre(true)}>
              Cerrar turno
            </Button>
          )
        ) : (
          <Button size="sm" disabled={pendiente} onClick={() => turnoAccion("iniciar")} className="bg-acento text-acento-foreground hover:bg-acento/90">
            Iniciar turno
          </Button>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        {paradas.length === 0 ? "No tienes limpiezas hoy." : `${hechas} de ${paradas.length} ${paradas.length === 1 ? "limpieza terminada" : "limpiezas terminadas"}`}
      </p>

      <ol className="space-y-2" aria-label="Limpiezas de hoy">
        {paradas.map((p) => (
          <li key={p.recId} className={cn("rounded-lg border bg-card p-3", p.terminada && "opacity-70")}>
            <div className="flex items-start gap-3">
              <span className="w-20 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">{p.hora || "—"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.unidad}</p>
                {p.comentario && <p className="mt-0.5 text-sm text-muted-foreground">{p.comentario}</p>}
              </div>
              {p.terminada ? (
                <Badge variant="secondary" className="gap-1">
                  <Check className="size-3" aria-hidden /> Terminada
                </Badge>
              ) : (
                <Badge variant="outline">{p.estado || "Programada"}</Badge>
              )}
            </div>
            {!p.terminada && (
              <div className="mt-3 flex gap-2 pl-23">
                {veCodigos && (
                  <Button variant="outline" size="sm" onClick={() => verIngreso(p)}>
                    <KeyRound className="size-4" aria-hidden /> Ingreso
                  </Button>
                )}
                <Button size="sm" variant="secondary" disabled={!turnoVisible} onClick={() => setAbierta({ parada: p, modo: "reporte" })} title={turnoVisible ? undefined : "Inicia el turno para reportar"}>
                  <Video className="size-4" aria-hidden /> Reportar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {codigos === "turno" && !turnoVisible && paradas.some((p) => !p.terminada) && <p className="text-xs text-muted-foreground">Los datos de ingreso aparecen cuando inicias el turno.</p>}

      <Sheet open={Boolean(abierta)} onOpenChange={(o) => !o && setAbierta(null)}>
        <SheetContent side="bottom" className="max-h-[90dvh]">
          {abierta?.modo === "reporte" && <Reporte parada={abierta.parada} video={video} alCerrar={() => setAbierta(null)} alGuardarLocal={() => void contar()} />}
          {abierta?.modo === "ingreso" && (
            <>
              <SheetHeader>
                <SheetTitle>Ingreso a {abierta.parada.unidad}</SheetTitle>
                <SheetDescription>Queda registrado que los abriste.</SheetDescription>
              </SheetHeader>
              {datos ? <Ingreso datos={datos} /> : <p className="px-4 text-sm text-muted-foreground">Cargando</p>}
              <div className="h-6" />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

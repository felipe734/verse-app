"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Mic, Plus, SendHorizontal, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useShell } from "@/components/shell/contexto";
import { cancelar, confirmar } from "@/app/asistente/acciones";
import { Button } from "@/components/ui/button";
import { TarjetaCorreo, type DatosTarjetaCorreo } from "./tarjeta-correo";

type Entrada =
  | { tipo: "persona"; texto: string }
  | { tipo: "asistente"; texto: string; herramientas: string[] }
  | { tipo: "propuesta"; id: string; resumen: string; estado: "pendiente" | "hecha" | "cancelada" | "error"; mensaje?: string; correo?: DatosTarjetaCorreo }
  | { tipo: "aviso"; texto: string };

const NOMBRES: Record<string, string> = {
  buscar_pendientes: "Buscando pendientes",
  resumen_hoy: "Revisando Hoy",
  proponer_cambio_pendiente: "Preparando el cambio",
  proponer_nuevo_pendiente: "Preparando el pendiente",
  buscar_unidades: "Buscando unidades",
  buscar_reservas: "Buscando reservas",
  ver_cierre: "Leyendo el cierre",
  ver_bandeja: "Revisando el correo",
  leer_hilo: "Leyendo el hilo",
  proponer_correo: "Redactando el correo",
};

interface ReconocimientoVoz {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

/** Lo que la persona tiene seleccionado: la fila abierta en el panel de detalle, si hay una. */
function seleccion(): string | null {
  const abierto = document.querySelector<HTMLElement>("[data-seleccion]");
  return abierto?.dataset.seleccion ?? null;
}

/**
 * Asistente en todas las pantallas: panel a la derecha en computador y hoja completa en
 * celular. Se abre con ⌘J, con el botón de la barra o desde ⌘K. Sabe la empresa, el módulo
 * (por la ruta) y la fila abierta.
 */
export function Asistente() {
  const { asistente: abierto, cerrarAsistente, borrador: texto, setBorrador: setTexto } = useShell();
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const conversacion = useRef<string | null>(null);
  const voz = useRef<ReconocimientoVoz | null>(null);
  const fondo = useRef<HTMLDivElement>(null);
  const ruta = usePathname();
  const parametros = useSearchParams();

  useEffect(() => {
    fondo.current?.scrollIntoView({ block: "end" });
  }, [entradas]);


  async function enviar(pregunta: string) {
    if (!pregunta.trim() || enviando) return;
    setTexto("");
    setEnviando(true);
    setEntradas((e) => [...e, { tipo: "persona", texto: pregunta }, { tipo: "asistente", texto: "", herramientas: [] }]);
    const actualizar = (f: (ultima: Extract<Entrada, { tipo: "asistente" }>) => Extract<Entrada, { tipo: "asistente" }>) =>
      setEntradas((e) => {
        const i = e.findLastIndex((x) => x.tipo === "asistente");
        if (i < 0) return e;
        const copia = [...e];
        copia[i] = f(copia[i] as Extract<Entrada, { tipo: "asistente" }>);
        return copia;
      });

    try {
      const r = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: pregunta,
          conversacionId: conversacion.current,
          pantalla: { ruta: `${ruta}${parametros.size ? `?${parametros}` : ""}`, seleccion: seleccion() },
        }),
      });
      if (!r.ok || !r.body) {
        const motivo = (await r.text()) || "El asistente no respondió.";
        setEntradas((e) => [...e, { tipo: "aviso", texto: motivo }]);
        return;
      }
      const lector = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let resto = "";
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        resto += value;
        const lineas = resto.split("\n");
        resto = lineas.pop() ?? "";
        for (const linea of lineas) {
          if (!linea.trim()) continue;
          const ev = JSON.parse(linea) as { tipo: string; [k: string]: unknown };
          if (ev.tipo === "conversacion") conversacion.current = ev.id as string;
          else if (ev.tipo === "texto") actualizar((u) => ({ ...u, texto: u.texto + (ev.delta as string) }));
          else if (ev.tipo === "herramienta") actualizar((u) => ({ ...u, herramientas: [...u.herramientas, ev.nombre as string] }));
          else if (ev.tipo === "propuesta") setEntradas((e) => [...e, { tipo: "propuesta", id: ev.id as string, resumen: ev.resumen as string, estado: "pendiente", correo: ev.correo as DatosTarjetaCorreo | undefined }]);
          else if (ev.tipo === "aviso") setEntradas((e) => [...e, { tipo: "aviso", texto: ev.texto as string }]);
        }
      }
    } catch {
      setEntradas((e) => [...e, { tipo: "aviso", texto: "Se perdió la conexión. Intenta de nuevo." }]);
    } finally {
      setEnviando(false);
    }
  }

  async function responder(id: string, si: boolean) {
    const r = si ? await confirmar(id) : await cancelar(id);
    setEntradas((e) =>
      e.map((x) => (x.tipo === "propuesta" && x.id === id ? { ...x, estado: r.ok ? (si ? "hecha" : "cancelada") : "error", mensaje: r.mensaje } : x)),
    );
  }

  function dictar() {
    const W = window as unknown as { SpeechRecognition?: new () => ReconocimientoVoz; webkitSpeechRecognition?: new () => ReconocimientoVoz };
    const Clase = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Clase) {
      setEntradas((e) => [...e, { tipo: "aviso", texto: "Este navegador no permite dictar." }]);
      return;
    }
    if (escuchando) {
      voz.current?.stop();
      return;
    }
    const r = new Clase();
    r.lang = "es-CO";
    r.interimResults = false;
    r.onresult = (e) => setTexto((t) => `${t} ${e.results[0]?.[0]?.transcript ?? ""}`.trim());
    r.onend = () => setEscuchando(false);
    voz.current = r;
    setEscuchando(true);
    r.start();
  }

  if (!abierto) return null;
  return (
    <aside
      aria-label="Asistente"
      className="fixed inset-0 z-50 flex flex-col bg-background md:sticky md:top-0 md:z-10 md:h-svh md:w-[400px] md:shrink-0 md:border-l"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-acento" aria-hidden /> Asistente
        </span>
        <span className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground"
            onClick={() => {
              conversacion.current = null;
              setEntradas([]);
            }}
          >
            <Plus className="size-4" aria-hidden /> Nueva
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={cerrarAsistente} aria-label="Cerrar asistente">
            <X className="size-4" aria-hidden />
          </Button>
        </span>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
        {entradas.length === 0 && (
          <div className="space-y-3 pt-6 text-muted-foreground">
            <p>Pregunta o pide algo. Sabe en qué módulo estás y qué fila tienes abierta.</p>
            <div className="flex flex-wrap gap-2">
              {["Qué tengo hoy", "Qué entra esta semana al Teik", "Listo 295"].map((x) => (
                <button key={x} type="button" onClick={() => setTexto(x)} className="rounded-full border px-3 py-1 text-xs text-foreground hover:bg-accent">
                  {x}
                </button>
              ))}
            </div>
          </div>
        )}
        {entradas.map((e, i) => {
          if (e.tipo === "persona")
            return (
              <p key={i} className="ml-10 rounded-lg bg-muted px-3 py-2 text-foreground">
                {e.texto}
              </p>
            );
          if (e.tipo === "asistente")
            return (
              <div key={i} className="space-y-1">
                {e.herramientas.map((h, j) => (
                  <p key={j} className="text-xs text-muted-foreground">
                    {NOMBRES[h] ?? h}
                  </p>
                ))}
                {e.texto ? (
                  <p className="whitespace-pre-line text-foreground">{e.texto}</p>
                ) : enviando && i === entradas.length - 1 ? (
                  <p className="animate-pulse text-muted-foreground">Pensando</p>
                ) : null}
              </div>
            );
          if (e.tipo === "propuesta" && e.correo) return <TarjetaCorreo key={i} id={e.id} correo={e.correo} />;
          if (e.tipo === "propuesta")
            return (
              <div key={i} className="space-y-2 rounded-lg border bg-card p-3">
                <p className="text-xs font-medium text-muted-foreground">Por confirmar</p>
                <p className="text-foreground">{e.resumen}</p>
                {e.estado === "pendiente" ? (
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-acento text-acento-foreground hover:bg-acento/90" onClick={() => void responder(e.id, true)}>
                      Confirmar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void responder(e.id, false)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <p role="status" className="text-muted-foreground">
                    {e.mensaje}
                  </p>
                )}
              </div>
            );
          return (
            <p key={i} role="status" className="text-xs text-muted-foreground">
              {e.texto}
            </p>
          );
        })}
        <div ref={fondo} />
      </div>
      <form
        className="border-t p-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          void enviar(texto);
        }}
      >
        <div className="flex items-end gap-2 rounded-lg border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/50">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar(texto);
              }
            }}
            rows={2}
            placeholder="Escribe o dicta"
            aria-label="Mensaje para el asistente"
            className="flex-1 resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={dictar} aria-pressed={escuchando} aria-label={escuchando ? "Parar el dictado" : "Dictar"}>
            {escuchando ? <Square className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
          </Button>
          <Button type="submit" size="icon" className="size-8 bg-acento text-acento-foreground hover:bg-acento/90" disabled={enviando || !texto.trim()} aria-label="Enviar">
            <SendHorizontal className="size-4" aria-hidden />
          </Button>
        </div>
      </form>
    </aside>
  );
}

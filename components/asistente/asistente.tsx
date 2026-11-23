"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

/** Lo que la persona tiene seleccionado: el pendiente abierto en Hoy, si hay uno. */
function seleccion(): string | null {
  const abierto = document.querySelector<HTMLElement>("details[open][data-numero]");
  return abierto ? `fila ${abierto.dataset.numero} de ${abierto.dataset.empresa}` : null;
}

/** Asistente en todas las pantallas: botón flotante, panel a la derecha en computador y hoja completa en celular. */
export function Asistente() {
  const [abierto, setAbierto] = useState(false);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [texto, setTexto] = useState("");
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

  return (
    <>
      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="fixed right-4 bottom-4 z-40 rounded-full bg-primary px-5 py-3 font-display text-sm text-primary-foreground shadow-lg"
        >
          Asistente
        </button>
      )}
      {abierto && (
        <aside
          aria-label="Asistente"
          className="fixed inset-0 z-50 flex flex-col bg-card md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:border-l md:shadow-xl"
        >
          <header className="flex items-center justify-between bg-primary px-5 py-3">
            <span className="font-display text-sm font-bold tracking-[3px] text-primary-foreground">
              ASISTENTE
            </span>
            <span className="flex gap-3">
              <button
                type="button"
                className="text-[12.5px] text-[#a9b8cc] underline"
                onClick={() => {
                  conversacion.current = null;
                  setEntradas([]);
                }}
              >
                Nueva
              </button>
              <button type="button" className="text-sm text-primary-foreground" onClick={() => setAbierto(false)} aria-label="Cerrar asistente">
                Cerrar
              </button>
            </span>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[14px] leading-relaxed text-[var(--verse-parrafo)]">
            {entradas.length === 0 && (
              <p className="text-muted-foreground">Pregunta o pide algo: &ldquo;qué tengo hoy&rdquo;, &ldquo;listo 295&rdquo;, &ldquo;agrega pendiente para Diana mañana&rdquo;.</p>
            )}
            {entradas.map((e, i) => {
              if (e.tipo === "persona")
                return (
                  <p key={i} className="ml-8 rounded-xl bg-[var(--verse-azul-claro)] px-3 py-2 text-[var(--verse-azul)]">
                    {e.texto}
                  </p>
                );
              if (e.tipo === "asistente")
                return (
                  <div key={i} className="space-y-1">
                    {e.herramientas.map((h, j) => (
                      <p key={j} className="text-[12px] text-muted-foreground">
                        {NOMBRES[h] ?? h}
                      </p>
                    ))}
                    {e.texto ? <p className="whitespace-pre-line text-foreground">{e.texto}</p> : enviando && i === entradas.length - 1 ? <p className="text-muted-foreground">Pensando</p> : null}
                  </div>
                );
              if (e.tipo === "propuesta" && e.correo)
                return <TarjetaCorreo key={i} id={e.id} correo={e.correo} />;
              if (e.tipo === "propuesta")
                return (
                  <div key={i} className="space-y-2 rounded-xl border px-3 py-3">
                    <p className="font-display text-[11px] tracking-[1.4px] text-muted-foreground">POR CONFIRMAR</p>
                    <p className="text-foreground">{e.resumen}</p>
                    {e.estado === "pendiente" ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void responder(e.id, true)}>
                          Confirmar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void responder(e.id, false)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <p role="status" className="text-[13px]">
                        {e.mensaje}
                      </p>
                    )}
                  </div>
                );
              return (
                <p key={i} role="status" className="text-[13px] text-muted-foreground">
                  {e.texto}
                </p>
              );
            })}
            <div ref={fondo} />
          </div>
          <form
            className="flex items-end gap-2 border-t p-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              void enviar(texto);
            }}
          >
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
              className="flex-1 resize-none rounded-lg border bg-white px-3 py-2 text-[14px]"
            />
            <Button type="button" variant="outline" onClick={dictar} aria-pressed={escuchando}>
              {escuchando ? "Parar" : "Dictar"}
            </Button>
            <Button type="submit" disabled={enviando || !texto.trim()}>
              Enviar
            </Button>
          </form>
        </aside>
      )}
    </>
  );
}

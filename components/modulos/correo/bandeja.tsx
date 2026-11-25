"use client";

import { ChevronRight, ExternalLink, Inbox, Paperclip, PenSquare, Search, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { leerHilo } from "@/app/modulos/correo";
import { BarraControles } from "@/components/modulos/barra-controles";
import { useShell } from "@/components/shell/contexto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MensajeHilo } from "@/lib/correo/bandeja";
import { cn } from "@/lib/utils";

export interface CorreoVista {
  cuenta: string;
  correoCuenta: string;
  id: string;
  hilo: string;
  de: string;
  asunto: string;
  vista: string;
  fecha: string;
  noLeido: boolean;
  adjuntos: number;
  responde: boolean;
  /** Necesita atención y respuesta (lib/correo/atencion.ts). */
  atencion: boolean;
  tambienEn: string[];
}

const remitente = (de: string) => de.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || de;
const hora = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const hoy = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat("es-CO", hoy ? { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" } : { timeZone: "America/Bogota", day: "numeric", month: "short" }).format(d);
};
const fechaHilo = (iso: string) => (iso ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "");

function Grupo({ titulo, n, abierto, fijo, alternar, children }: { titulo: string; n: number; abierto: boolean; fijo?: boolean; alternar?: () => void; children: React.ReactNode }) {
  return (
    <section aria-label={titulo}>
      <h2 className="sticky top-14 z-10 border-b bg-muted/60 text-xs font-medium text-muted-foreground backdrop-blur">
        <button type="button" disabled={fijo} aria-expanded={abierto} onClick={alternar} className="flex w-full items-center gap-2 px-4 py-1.5 text-left enabled:hover:text-foreground md:px-6">
          {!fijo && <ChevronRight className={cn("size-3.5 transition-transform", abierto && "rotate-90")} aria-hidden />}
          {titulo}
          <span className="tabular-nums">{n}</span>
        </button>
      </h2>
      {abierto && children}
    </section>
  );
}

function Fila({ c, abrir }: { c: CorreoVista; abrir: (c: CorreoVista) => void }) {
  return (
    <li>
      <button type="button" onClick={() => abrir(c)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-muted/50 md:px-6">
        <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", c.noLeido ? "bg-acento" : "bg-transparent")} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={cn("truncate text-sm", c.noLeido && "font-semibold")}>{remitente(c.de)}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{hora(c.fecha)}</span>
          </span>
          <span className={cn("block truncate text-sm", c.noLeido ? "text-foreground" : "text-muted-foreground")}>{c.asunto}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{c.vista}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{c.correoCuenta}</span>
            {c.adjuntos > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip className="size-3" aria-hidden /> {c.adjuntos}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Bandeja ruteada: colas de os-correo, el hilo en panel lateral y el asistente para responder. */
export function Bandeja({
  colas,
  cuentas,
  cuenta,
  ruido,
  avisos,
  horas,
  puedeRedactar,
}: {
  colas: { id: string; items: CorreoVista[] }[];
  cuentas: { id: string; correo: string }[];
  cuenta: string | null;
  ruido: number;
  avisos: string[];
  horas: number;
  puedeRedactar: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { abrirAsistente, asistenteHabilitado } = useShell();
  const [abierto, setAbierto] = useState<CorreoVista | null>(null);
  const [hilo, setHilo] = useState<{ mensajes: MensajeHilo[] } | { error: string } | null>(null);
  const [cargando, iniciar] = useTransition();

  function abrir(c: CorreoVista) {
    setAbierto(c);
    setHilo(null);
    iniciar(async () => setHilo(await leerHilo(c.cuenta, c.hilo)));
  }

  function elegirCuenta(id: string) {
    const q = new URLSearchParams(params);
    if (id) q.set("cuenta", id);
    else q.delete("cuenta");
    router.push(`?${q}`);
  }

  const [texto, setTexto] = useState("");
  const [verResto, setVerResto] = useState(false);
  const total = colas.reduce((n, c) => n + c.items.length, 0);
  const coincide = (c: CorreoVista) => !texto || `${c.de} ${c.asunto} ${c.vista}`.toLowerCase().includes(texto.toLowerCase());
  const todos = colas.flatMap((q) => q.items).filter(coincide).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const importantes = todos.filter((c) => c.atencion);
  const resto = todos.filter((c) => !c.atencion);

  return (
    <>
      <BarraControles className="px-4 pt-1 md:px-6">
        {cuentas.length > 1 && (
          <div role="radiogroup" aria-label="Cuenta" className="flex max-w-full gap-1 overflow-x-auto rounded-md border p-0.5 [scrollbar-width:none]">
            {[{ id: "", correo: "Todas" }, ...cuentas].map((c) => (
              <button
                key={c.id || "todas"}
                type="button"
                role="radio"
                aria-checked={(cuenta ?? "") === c.id}
                onClick={() => elegirCuenta(c.id)}
                className={cn("shrink-0 rounded px-2 py-1 text-xs whitespace-nowrap", (cuenta ?? "") === c.id ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                {c.id ? `${c.correo.split("@")[0]}@` : c.correo}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 max-md:w-full">
          <div className="relative min-w-0 flex-1 md:w-52 md:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar" aria-label="Buscar correos" className="h-8 pl-8" />
          </div>
          {puedeRedactar && asistenteHabilitado && (
            <Button size="sm" className="h-8 gap-1.5 bg-acento text-acento-foreground hover:bg-acento/90" onClick={() => abrirAsistente("Redacta un correo ")}>
              <PenSquare className="size-4" aria-hidden /> Redactar
            </Button>
          )}
        </div>
      </BarraControles>

      {avisos.map((a) => (
        <p key={a} role="status" className="mx-4 mb-3 rounded-md border bg-muted/50 px-3 py-2 text-sm md:mx-6">
          {a}
        </p>
      ))}

      {total === 0 ? (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-24 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <p className="font-medium">Nada nuevo en {horas} horas</p>
          <p className="text-sm text-muted-foreground">{ruido ? `${ruido} correos de promociones o avisos no se listan.` : "Cuando llegue algo a tus cuentas, aparece aquí."}</p>
        </div>
      ) : (
        <>
          <Grupo titulo="Para responder" n={importantes.length} abierto fijo>
            {importantes.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground md:px-6">Nada que responder ahora.</p>
            ) : (
              <ul className="divide-y">{importantes.map((c) => <Fila key={`${c.cuenta}-${c.id}`} c={c} abrir={abrir} />)}</ul>
            )}
          </Grupo>
          {resto.length > 0 && (
            <Grupo titulo="Informativo" n={resto.length} abierto={verResto || Boolean(texto)} alternar={() => setVerResto((v) => !v)}>
              <ul className="divide-y">{resto.map((c) => <Fila key={`${c.cuenta}-${c.id}`} c={c} abrir={abrir} />)}</ul>
            </Grupo>
          )}
        </>
      )}
      {total > 0 && ruido > 0 && <p className="px-4 py-4 text-xs text-muted-foreground md:px-6">{ruido} correos de promociones, boletines o firmas de AFFI no se listan.</p>}

      <Sheet open={Boolean(abierto)} onOpenChange={(v) => !v && setAbierto(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-xl" data-seleccion={abierto ? `hilo ${abierto.hilo} de la cuenta ${abierto.cuenta}` : undefined}>
          {abierto && (
            <>
              <SheetHeader className="border-b">
                <SheetDescription>{abierto.correoCuenta}</SheetDescription>
                <SheetTitle className="text-base leading-snug">{abierto.asunto}</SheetTitle>
              </SheetHeader>
              <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
                {cargando || !hilo ? (
                  <div className="animate-pulse space-y-2" aria-busy="true">
                    <div className="h-4 w-1/2 rounded bg-muted" />
                    <div className="h-24 rounded bg-muted/70" />
                  </div>
                ) : "error" in hilo ? (
                  <p role="alert">{hilo.error}</p>
                ) : (
                  hilo.mensajes.map((m) => (
                    <article key={m.id} className="space-y-2 rounded-lg border p-3">
                      <header className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{remitente(m.de)}</span> · {fechaHilo(m.fecha)}
                      </header>
                      {/* Texto legible: el HTML del remitente se convierte a párrafos y nunca se pinta tal cual. */}
                      <div className="whitespace-pre-wrap break-words leading-relaxed">{m.texto}</div>
                      {m.adjuntos.length > 0 && <p className="text-xs text-muted-foreground">Adjuntos: {m.adjuntos.join(", ")}</p>}
                    </article>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t p-4">
                {abierto.responde && puedeRedactar && asistenteHabilitado && (
                  <Button className="gap-1.5 bg-acento text-acento-foreground hover:bg-acento/90" onClick={() => abrirAsistente("Responde este correo: ")}>
                    <Sparkles className="size-4" aria-hidden /> Responder con el asistente
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <a href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(abierto.correoCuenta)}#all/${abierto.hilo}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" aria-hidden /> Abrir en Gmail
                  </a>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

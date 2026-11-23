"use client";

import { ExternalLink, Inbox, Paperclip, PenSquare, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { leerHilo } from "@/app/modulos/correo";
import { AccionesModulo } from "@/components/shell/barra-superior";
import { useShell } from "@/components/shell/contexto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  tambienEn: string[];
}

const COLAS: Record<string, string> = {
  host: "Verse Host",
  living: "Verse Living",
  contabilidad: "Contabilidad",
  comercial: "Comercial",
  dirección: "Dirección",
  sistema: "Sistema",
  svmg: "SVMG",
  obra: "Obra",
};

const remitente = (de: string) => de.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || de;
const hora = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const hoy = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat("es-CO", hoy ? { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" } : { timeZone: "America/Bogota", day: "numeric", month: "short" }).format(d);
};
const fechaHilo = (iso: string) => (iso ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "");

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

  const total = colas.reduce((n, c) => n + c.items.length, 0);

  return (
    <>
      <AccionesModulo>
        {cuentas.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                {cuenta ? cuentas.find((c) => c.id === cuenta)?.correo.split("@")[0] + "@" : "Todas las cuentas"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={cuenta ?? ""} onValueChange={elegirCuenta}>
                <DropdownMenuRadioItem value="">Todas las cuentas</DropdownMenuRadioItem>
                {cuentas.map((c) => (
                  <DropdownMenuRadioItem key={c.id} value={c.id}>
                    {c.correo}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {puedeRedactar && asistenteHabilitado && (
          <Button size="sm" className="h-8 gap-1.5 bg-acento text-acento-foreground hover:bg-acento/90" onClick={() => abrirAsistente("Redacta un correo ")}>
            <PenSquare className="size-4" aria-hidden /> Redactar
          </Button>
        )}
      </AccionesModulo>

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
        colas.map((cola) => {
          const [, nombre] = cola.id.split("·");
          return (
            <section key={cola.id} aria-labelledby={`cola-${cola.id}`}>
              <h2 id={`cola-${cola.id}`} className="sticky top-14 z-10 flex items-center gap-2 border-b bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur md:px-6">
                {COLAS[nombre!] ?? nombre}
                <span className="tabular-nums">{cola.items.length}</span>
              </h2>
              <ul className="divide-y">
                {cola.items.map((c) => (
                  <li key={`${c.cuenta}-${c.id}`}>
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
                          {!c.responde && <Badge variant="secondary">No se responde</Badge>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
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
                      {/* Texto plano: el HTML del remitente nunca se pinta en la app. */}
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

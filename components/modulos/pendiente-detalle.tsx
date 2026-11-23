"use client";

import { ExternalLink, Mail, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useShell } from "@/components/shell/contexto";
import { fechaLarga } from "@/lib/hoy/fechas";
import type { FilaVista } from "./tipos";

/** Detalle de una fila de TRAZABILIDAD en panel lateral, con sus enlaces y acciones. */
export function PendienteDetalle({ fila, abierto, alCerrar, acciones }: { fila: FilaVista | null; abierto: boolean; alCerrar: () => void; acciones?: React.ReactNode }) {
  const { abrirAsistente, asistenteHabilitado } = useShell();
  return (
    <Sheet open={abierto} onOpenChange={(v) => !v && alCerrar()}>
      <SheetContent className="w-full gap-0 sm:max-w-md" data-seleccion={fila ? `fila ${fila.numero ?? ""} de ${fila.empresa}` : undefined}>
        {fila && (
          <>
            <SheetHeader className="border-b">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="tabular-nums">#{fila.numero ?? "—"}</span>
                <span aria-hidden>·</span>
                <span>{fila.empresa}</span>
                {fila.critico && <Badge variant="destructive">Crítico</Badge>}
                {fila.estado === "En espera" && <Badge variant="secondary">En espera</Badge>}
              </div>
              <SheetTitle className="text-base leading-snug">{fila.asunto ?? "Sin asunto"}</SheetTitle>
              <SheetDescription>{fila.accion}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Responsable</dt>
                <dd>{fila.responsable ?? "—"}</dd>
                <dt className="text-muted-foreground">Fecha límite</dt>
                <dd className="first-letter:uppercase">
                  {fechaLarga(fila.fechaLimite)}
                  {fila.atraso > 0 && <span className="text-muted-foreground"> · {fila.atraso} d de atraso</span>}
                </dd>
                <dt className="text-muted-foreground">Proceso</dt>
                <dd>{fila.proceso ?? "—"}</dd>
                <dt className="text-muted-foreground">Línea</dt>
                <dd>{fila.linea ?? "—"}</dd>
              </dl>
              {fila.resto && (
                <section className="space-y-1.5">
                  <h3 className="text-xs font-medium text-muted-foreground">Detalle</h3>
                  <p className="whitespace-pre-line leading-relaxed">{fila.resto}</p>
                </section>
              )}
              <section className="flex flex-col gap-1">
                {fila.link && (
                  <a className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent" href={fila.link} target="_blank" rel="noreferrer">
                    {fila.link.includes("mail.google.com") ? <Mail className="size-4 text-muted-foreground" aria-hidden /> : <ExternalLink className="size-4 text-muted-foreground" aria-hidden />}
                    {fila.link.includes("mail.google.com") ? "Abrir el correo" : "Abrir el link"}
                  </a>
                )}
                {fila.urlCorrida && (
                  <a className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent" href={fila.urlCorrida} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4 text-muted-foreground" aria-hidden /> Ver la corrida
                  </a>
                )}
                <a className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent" href={fila.urlAirtable} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4 text-muted-foreground" aria-hidden /> Fila en Airtable
                </a>
              </section>
            </div>
            <SheetFooter className="border-t">
              {acciones}
              {asistenteHabilitado && (
                <Button variant="ghost" className="justify-start gap-2" onClick={() => abrirAsistente(`Sobre la fila ${fila.numero} de ${fila.empresa}: `)}>
                  <Sparkles className="size-4" aria-hidden /> Preguntar al asistente
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

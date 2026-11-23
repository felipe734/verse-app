"use client";

import { CheckCheck, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Accion, ResultadoAccion } from "@/lib/hoy/acciones";
import { PendienteDetalle } from "../pendiente-detalle";
import type { FilaVista } from "../tipos";

export interface AprobacionVista extends FilaVista {
  cambio: string;
  puedeResponder: boolean;
}

type Ejecutar = (recId: string, accion: Accion) => Promise<ResultadoAccion>;

/** Sí o no. El sí pide un segundo toque: Verse OS aplicará el cambio. */
function Responder({ a, responder }: { a: AprobacionVista; responder: (x: "aprobar" | "rechazar") => void }) {
  const [confirmar, setConfirmar] = useState(false);
  if (!a.puedeResponder) return <span className="text-xs text-muted-foreground">Sin la casilla Aprobar</span>;
  return confirmar ? (
    <span className="flex items-center gap-2">
      <Button size="sm" className="h-8 bg-acento text-acento-foreground hover:bg-acento/90" onClick={() => responder("aprobar")}>
        Confirmar
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={() => setConfirmar(false)}>
        Volver
      </Button>
    </span>
  ) : (
    <span className="flex items-center gap-2">
      <Button size="sm" variant="outline" className="h-8" onClick={() => setConfirmar(true)}>
        Sí
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={() => responder("rechazar")}>
        No
      </Button>
    </span>
  );
}

export function ListaAprobar({ abiertas, enCurso, conEmpresa, ejecutar }: { abiertas: AprobacionVista[]; enCurso: AprobacionVista[]; conEmpresa: boolean; ejecutar: Ejecutar }) {
  const router = useRouter();
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<string | null>(null);
  const visibles = abiertas.filter((a) => !quitadas.has(a.recId));
  const detalle = [...abiertas, ...enCurso].find((a) => a.recId === abierta) ?? null;

  function responder(a: AprobacionVista, tipo: "aprobar" | "rechazar") {
    setQuitadas((q) => new Set(q).add(a.recId));
    setAbierta(null);
    void ejecutar(a.recId, { tipo }).then((r) => {
      if (r.ok) {
        toast.success(r.mensaje, { description: a.asunto ?? undefined });
        router.refresh();
      } else {
        setQuitadas((q) => {
          const n = new Set(q);
          n.delete(a.recId);
          return n;
        });
        toast.error(r.mensaje);
      }
    });
  }

  return (
    <>
      {visibles.length === 0 ? (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-24 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <CheckCheck className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <p className="font-medium">No hay cambios esperando tu respuesta</p>
          <p className="text-sm text-muted-foreground">Cuando Verse OS proponga un cambio con &ldquo;Aprobar:&rdquo;, aparece aquí.</p>
        </div>
      ) : (
        <section aria-labelledby="sec-responder">
          <h2 id="sec-responder" className="sticky top-14 z-10 flex items-center gap-2 border-b bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur md:px-6">
            Por responder <span className="tabular-nums">{visibles.length}</span>
          </h2>
          <ul className="divide-y">
            {visibles.map((a) => (
              <li key={a.recId} className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/50 md:flex-row md:items-start md:gap-4 md:px-6">
                <button type="button" onClick={() => setAbierta(a.recId)} className="min-w-0 flex-1 space-y-1 text-left">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{a.asunto ?? "Sin asunto"}</span>
                    {conEmpresa && <Badge variant="outline">{a.empresa}</Badge>}
                  </span>
                  <span className="line-clamp-2 block text-[13px] text-muted-foreground">{a.cambio}</span>
                  <span className="block text-xs text-muted-foreground">{[`#${a.numero ?? ""}`, a.proceso, a.responsable].filter(Boolean).join(" · ")}</span>
                </button>
                <Responder a={a} responder={(t) => responder(a, t)} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {enCurso.length > 0 && (
        <section aria-labelledby="sec-curso" className="mt-6">
          <h2 id="sec-curso" className="flex items-center gap-2 border-y bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground md:px-6">
            <Clock className="size-3.5" aria-hidden /> Aprobadas, esperando a Verse OS <span className="tabular-nums">{enCurso.length}</span>
          </h2>
          <ul className="divide-y">
            {enCurso.map((a) => (
              <li key={a.recId}>
                <button type="button" onClick={() => setAbierta(a.recId)} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50 md:px-6">
                  <span className="font-medium">{a.asunto}</span> <span className="text-muted-foreground">· {a.cambio}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <PendienteDetalle
        fila={detalle ? { ...detalle, resto: detalle.cambio } : null}
        abierto={Boolean(detalle)}
        alCerrar={() => setAbierta(null)}
        acciones={detalle && abiertas.includes(detalle) && !quitadas.has(detalle.recId) ? <Responder a={detalle} responder={(t) => responder(detalle, t)} /> : undefined}
      />
    </>
  );
}

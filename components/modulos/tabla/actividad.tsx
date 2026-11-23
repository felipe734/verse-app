"use client";

import { useEffect, useState } from "react";
import { actividadAccion, type RefModulo } from "@/app/modulos/editar";
import type { Evento } from "@/lib/modulos/actividad";

const hace = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });
};

/** Quién cambió qué en esta fila desde la app. */
export function Actividad({ refModulo, recId }: { refModulo: RefModulo; recId: string }) {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  useEffect(() => {
    let vivo = true;
    actividadAccion(refModulo, recId).then((e) => vivo && setEventos(e), () => vivo && setEventos([]));
    return () => {
      vivo = false;
    };
  }, [refModulo, recId]);
  if (!eventos?.length) return null;
  return (
    <section aria-label="Actividad" className="space-y-1.5 border-t p-4">
      <h3 className="text-xs font-medium text-muted-foreground">Actividad en la app</h3>
      <ol className="space-y-1.5 text-xs">
        {eventos.map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-20 shrink-0 text-muted-foreground">{hace(e.cuando)}</span>
            <span className="min-w-0">
              <span className="font-medium">{e.autor}</span> {e.resumen}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

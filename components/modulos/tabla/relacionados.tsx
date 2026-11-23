"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { relacionadosDe, type RefModulo } from "@/app/modulos/editar";
import type { BloqueRelacionado } from "@/lib/modulos/relacionados";

/** Bloques de registros relacionados de la fila abierta; cargan al abrir el detalle. */
export function Relacionados({ refModulo, celdas }: { refModulo: RefModulo; celdas: Record<string, string> }) {
  const [bloques, setBloques] = useState<BloqueRelacionado[] | null>(null);
  useEffect(() => {
    let vivo = true;
    relacionadosDe(refModulo, celdas).then((b) => vivo && setBloques(b), () => vivo && setBloques([]));
    return () => {
      vivo = false;
    };
  }, [refModulo, celdas]);

  if (bloques === null)
    return (
      <div className="space-y-2 border-t p-4" aria-busy="true" aria-label="Cargando relacionados">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded bg-muted/70" />
      </div>
    );
  if (!bloques.length) return null;
  return (
    <div className="space-y-4 border-t p-4">
      {bloques.map((b) => (
        <section key={b.titulo} aria-label={b.titulo} className="space-y-1.5">
          <h3 className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            {b.titulo} · {b.filas.length}
            <Link href={b.href} className="inline-flex items-center gap-0.5 hover:text-foreground">
              Ir <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          </h3>
          {b.filas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada relacionado.</p>
          ) : (
            <ul className="divide-y rounded-md border text-xs">
              {b.filas.map((f) => (
                <li key={f.id} className="grid grid-cols-2 gap-x-2 px-2.5 py-1.5">
                  {b.columnas.map((c, i) => (
                    <span key={c.campo} className={i === 0 ? "truncate font-medium" : "truncate text-muted-foreground"}>
                      {f.celdas[c.campo] || "—"}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

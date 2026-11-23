"use client";

import { useActionState } from "react";
import type { Resultado } from "@/app/(privado)/(fijas)/ajustes/acciones";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Formulario de Ajustes con el resultado de la acción junto al botón. */
export function Forma({
  action,
  boton,
  children,
  className,
}: {
  action: (estado: Resultado | null, datos: FormData) => Promise<Resultado>;
  boton: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [estado, enviar, enviando] = useActionState(action, null);
  return (
    <form action={enviar} className={className ?? "space-y-4"}>
      {children}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={enviando} className="bg-acento text-acento-foreground hover:bg-acento/90">
          {enviando ? "Guardando" : boton}
        </Button>
        {estado && (
          <span role="status" className={cn("text-sm", estado.ok ? "text-muted-foreground" : "text-destructive")}>
            {estado.mensaje}
          </span>
        )}
      </div>
    </form>
  );
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-xs text-muted-foreground">{ayuda}</span>}
    </label>
  );
}

export const estiloEntrada =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

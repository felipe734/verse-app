"use client";

import { useActionState } from "react";
import type { Resultado } from "@/app/(privado)/(fijas)/ajustes/acciones";
import { Button } from "@/components/ui/button";

/** Formulario de Ajustes con el resultado de la acción debajo del botón. */
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
    <form action={enviar} className={className ?? "space-y-3"}>
      {children}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Guardando" : boton}
        </Button>
        {estado && (
          <span role="status" className={estado.ok ? "text-foreground" : "text-foreground"}>
            {estado.mensaje}
          </span>
        )}
      </div>
    </form>
  );
}

export function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] tracking-[1.2px] text-muted-foreground">{etiqueta.toUpperCase()}</span>
      {children}
    </label>
  );
}

export const estiloEntrada = "w-full rounded-lg border bg-white px-3 py-2 text-foreground";

"use client";

import { useActionState, useState } from "react";
import type { Resultado } from "@/app/(privado)/(fijas)/ajustes/acciones";
import { Button } from "@/components/ui/button";

/** Genera el enlace de invitación y lo muestra una sola vez para copiarlo. */
export function Invitar({ action }: { action: () => Promise<Resultado> }) {
  const [estado, generar, generando] = useActionState(async () => action(), null);
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-2">
      <form action={generar}>
        <Button type="submit" variant="outline" disabled={generando}>
          {generando ? "Generando" : "Generar enlace de invitación"}
        </Button>
      </form>
      {estado && <p role="status">{estado.mensaje}</p>}
      {estado?.enlace && (
        <div className="flex gap-2">
          <input readOnly value={estado.enlace} className="h-9 w-full rounded-md border bg-transparent px-3 text-xs" aria-label="Enlace de invitación" />
          <Button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(estado.enlace!);
              setCopiado(true);
            }}
          >
            {copiado ? "Copiado" : "Copiar"}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Accion, ResultadoAccion } from "@/lib/hoy/acciones";

/** Sí o no a una fila "Aprobar: ". El sí pide un toque más: es una acción con efecto. */
export function Responder({ ejecutar }: { ejecutar: (a: Accion) => Promise<ResultadoAccion> }) {
  const [pendiente, iniciar] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const correr = (a: Accion) =>
    iniciar(async () => {
      const r = await ejecutar(a);
      setMensaje(r.mensaje);
      setConfirmar(false);
    });

  if (mensaje) return <p role="status" className="text-[13.5px]">{mensaje}</p>;
  return confirmar ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13.5px]">Verse OS aplicará este cambio. ¿Confirmas?</span>
      <Button size="sm" disabled={pendiente} onClick={() => correr({ tipo: "aprobar" })}>
        Sí, aprobar
      </Button>
      <Button size="sm" variant="outline" disabled={pendiente} onClick={() => setConfirmar(false)}>
        Volver
      </Button>
    </div>
  ) : (
    <div className="flex gap-2">
      <Button size="sm" disabled={pendiente} onClick={() => setConfirmar(true)}>
        Sí
      </Button>
      <Button size="sm" variant="outline" disabled={pendiente} onClick={() => correr({ tipo: "rechazar" })}>
        No
      </Button>
    </div>
  );
}

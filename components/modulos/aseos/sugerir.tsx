"use client";

import { Sparkles } from "lucide-react";
import { useShell } from "@/components/shell/contexto";
import { Button } from "@/components/ui/button";

/** Le pide al asistente un plan para repartir los aseos de la semana entre las aseadoras activas. */
export function SugerirReorganizacion() {
  const { abrirAsistente, asistenteHabilitado } = useShell();
  if (!asistenteHabilitado) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      onClick={() =>
        abrirAsistente(
          "Sugiéreme cómo reorganizar los aseos de esta semana con las aseadoras activas en FUNCIONARIAS: equilibra la carga por día, junta los del mismo edificio, respeta las horas de ingreso y salida de las reservas y dime qué aseos quedaron sin aseadora. Dame la propuesta en una tabla por día y no cambies nada sin que te lo apruebe.",
        )
      }
    >
      <Sparkles className="size-4" aria-hidden /> Sugerir reorganización
    </Button>
  );
}

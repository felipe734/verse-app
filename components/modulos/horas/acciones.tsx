"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cerrarOlvidadoAccion, validarSemanaAccion } from "@/app/modulos/horas";
import { Button } from "@/components/ui/button";

export function CerrarTurno({ recId }: { recId: string }) {
  const [hora, setHora] = useState("17:00");
  const [ocupado, setOcupado] = useState(false);
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setOcupado(true);
        const r = await cerrarOlvidadoAccion(recId, hora);
        setOcupado(false);
        if (r.ok) toast.success(r.mensaje);
        else toast.error(r.mensaje);
      }}
    >
      <input type="time" step={300} required value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora de salida" className="rounded-md border bg-background px-2 py-1 text-sm" />
      <Button size="sm" variant="outline" type="submit" disabled={ocupado}>
        {ocupado && <Loader2 className="size-4 animate-spin" aria-hidden />} Cerrar
      </Button>
    </form>
  );
}

export function ValidarSemana({ nombre, lunes, deshabilitado }: { nombre: string; lunes: string; deshabilitado?: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <Button
      size="sm"
      className="gap-1.5"
      disabled={ocupado || deshabilitado}
      title={deshabilitado ? "Cierra los turnos sin salida primero" : undefined}
      onClick={async () => {
        setOcupado(true);
        const r = await validarSemanaAccion(nombre, lunes);
        setOcupado(false);
        if (r.ok) toast.success(r.mensaje);
        else toast.error(r.mensaje);
      }}
    >
      {ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} Validar semana
    </Button>
  );
}

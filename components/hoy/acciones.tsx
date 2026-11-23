"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Accion, ResultadoAccion } from "@/lib/hoy/acciones";

type Ejecutar = (accion: Accion) => Promise<ResultadoAccion>;

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Próximo lunes (si hoy es lunes, el de la otra semana). */
function lunes(hoy: string): string {
  const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay();
  return sumarDias(hoy, ((8 - dia) % 7) || 7);
}

const UMBRAL = 90;

/**
 * Pendiente con gestos: deslizar a la derecha cierra, a la izquierda aplaza hasta mañana.
 * Mientras se envía queda atenuado; si Airtable no acepta, vuelve y muestra el motivo.
 */
export function Deslizable({ ejecutar, hoy, activo, children }: { ejecutar: Ejecutar; hoy: string; activo: boolean; children: React.ReactNode }) {
  const [dx, setDx] = useState(0);
  const [estado, setEstado] = useState<"normal" | "enviando" | "hecho">("normal");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef(false);

  async function correr(accion: Accion) {
    setEstado("enviando");
    setMensaje(null);
    const r = await ejecutar(accion);
    setMensaje(r.mensaje);
    setEstado(r.ok ? "hecho" : "normal");
    setDx(0);
  }

  if (estado === "hecho") {
    return (
      <p role="status" className="py-2.5 text-[13.5px] text-muted-foreground">
        {mensaje}
      </p>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {activo && dx !== 0 && (
        <div aria-hidden className={`absolute inset-0 flex items-center px-4 font-display text-sm text-[var(--verse-azul)] ${dx > 0 ? "justify-start" : "justify-end"} bg-[var(--verse-azul-claro)]`}>
          {dx > 0 ? "Cerrar" : "Aplazar a mañana"}
        </div>
      )}
      <div
        style={{ transform: `translateX(${dx}px)`, transition: arrastrando ? "none" : "transform 150ms" }}
        className={`relative bg-card ${estado === "enviando" ? "opacity-50" : ""}`}
        onPointerDown={(e) => {
          if (!activo || e.pointerType === "mouse") return;
          inicio.current = { x: e.clientX, y: e.clientY };
          horizontal.current = false;
          setArrastrando(true);
        }}
        onPointerMove={(e) => {
          if (!inicio.current) return;
          const x = e.clientX - inicio.current.x;
          const y = e.clientY - inicio.current.y;
          if (!horizontal.current && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y)) horizontal.current = true;
          if (horizontal.current) setDx(Math.max(-140, Math.min(140, x)));
        }}
        onPointerUp={() => {
          const final = dx;
          inicio.current = null;
          setArrastrando(false);
          if (final >= UMBRAL) void correr({ tipo: "cerrar" });
          else if (final <= -UMBRAL) void correr({ tipo: "aplazar", hasta: sumarDias(hoy, 1) });
          else setDx(0);
        }}
        onPointerCancel={() => {
          inicio.current = null;
          setArrastrando(false);
          setDx(0);
        }}
      >
        {children}
      </div>
      {mensaje && (
        <p role="alert" className="pb-2 text-[13px] text-foreground">
          {mensaje}
        </p>
      )}
    </div>
  );
}

/** Botones del detalle: cerrar, aplazar (mañana, lunes o fecha) y descartar. */
export function Botones({ ejecutar, hoy }: { ejecutar: Ejecutar; hoy: string }) {
  const [pendiente, iniciar] = useTransition();
  const [fecha, setFecha] = useState(sumarDias(hoy, 1));
  const [mensaje, setMensaje] = useState<string | null>(null);
  const correr = (a: Accion) =>
    iniciar(async () => {
      const r = await ejecutar(a);
      setMensaje(r.mensaje);
    });

  return (
    <div className="space-y-2 border-t pt-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pendiente} onClick={() => correr({ tipo: "cerrar" })}>
          Cerrar
        </Button>
        <Button size="sm" variant="outline" disabled={pendiente} onClick={() => correr({ tipo: "aplazar", hasta: sumarDias(hoy, 1) })}>
          Mañana
        </Button>
        <Button size="sm" variant="outline" disabled={pendiente} onClick={() => correr({ tipo: "aplazar", hasta: lunes(hoy) })}>
          Lunes
        </Button>
        <Button size="sm" variant="outline" disabled={pendiente} onClick={() => correr({ tipo: "descartar" })}>
          Descartar
        </Button>
      </div>
      <div className="flex items-center gap-2 text-[13px]">
        <label htmlFor="fecha-aplazar">Aplazar hasta</label>
        <input id="fecha-aplazar" type="date" min={sumarDias(hoy, 1)} value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-lg border bg-white px-2 py-1" />
        <Button size="sm" variant="outline" disabled={pendiente} onClick={() => correr({ tipo: "aplazar", hasta: fecha })}>
          Aplazar
        </Button>
      </div>
      {mensaje && (
        <p role="status" className="text-[13px]">
          {mensaje}
        </p>
      )}
    </div>
  );
}

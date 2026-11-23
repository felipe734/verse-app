"use client";

import { useEffect, useState } from "react";
import { guardarSuscripcion, quitarSuscripcion } from "@/app/avisos/acciones";
import { Button } from "@/components/ui/button";

function aBytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  const salida = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) salida[i] = b.charCodeAt(i);
  return salida;
}

type Estado = "cargando" | "no-soportado" | "instalar" | "apagado" | "encendido" | "bloqueado";

/**
 * Activa los avisos de críticos, aprobaciones y fallas en este dispositivo.
 * En iPhone solo funciona con la app instalada en la pantalla de inicio.
 */
export function ActivarAvisos({ clavePublica }: { clavePublica: string }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const instalada = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setEstado(ios && !instalada ? "instalar" : "no-soportado");
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub ? "encendido" : "apagado");
    })().catch(() => setEstado("no-soportado"));
  }, []);

  async function activar() {
    setMensaje(null);
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return setEstado(permiso === "denied" ? "bloqueado" : "apagado");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clavePublica) });
    const r = await guardarSuscripcion(sub.toJSON());
    setMensaje(r.mensaje);
    setEstado(r.ok ? "encendido" : "apagado");
  }

  async function desactivar() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const r = await quitarSuscripcion(sub.endpoint);
      await sub.unsubscribe();
      setMensaje(r.mensaje);
    }
    setEstado("apagado");
  }

  if (estado === "cargando") return null;
  if (estado === "no-soportado") return <p className="text-[12.5px] text-muted-foreground">Este navegador no recibe avisos.</p>;
  if (estado === "instalar")
    return <p className="text-[12.5px] text-muted-foreground">Para recibir avisos en el iPhone, agrega la app a la pantalla de inicio (Compartir › Agregar a inicio) y ábrela desde ahí.</p>;
  if (estado === "bloqueado") return <p className="text-[12.5px] text-muted-foreground">Los avisos están bloqueados en la configuración del navegador.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
      {estado === "encendido" ? (
        <Button size="sm" variant="outline" onClick={() => void desactivar()}>
          Apagar avisos
        </Button>
      ) : (
        <Button size="sm" onClick={() => void activar()}>
          Activar avisos
        </Button>
      )}
      <span className="text-muted-foreground">{mensaje ?? "Críticos, aprobaciones y fallas."}</span>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { Asistente } from "@/components/asistente/asistente";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BarraLateral } from "./barra-lateral";
import { BarraMovil } from "./barra-movil";
import { BarraSuperior } from "./barra-superior";
import { Comandos } from "./comandos";
import { ProveedorShell } from "./contexto";
import type { DatosShell } from "./tipos";

export function ShellCliente({
  d,
  acento,
  abierta,
  salir,
  children,
}: {
  d: DatosShell;
  acento: { fondo: string; texto: string };
  abierta: boolean;
  salir: () => Promise<void>;
  children: React.ReactNode;
}) {
  // Menús, diálogos y avisos se montan en <body>: el acento va en la raíz del documento.
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--acento", acento.fondo);
    r.setProperty("--acento-foreground", acento.texto);
  }, [acento.fondo, acento.texto]);
  return (
    <ProveedorShell asistenteHabilitado={d.asistente}>
      <TooltipProvider delayDuration={300}>
        <SidebarProvider defaultOpen={abierta}>
          <BarraLateral d={d} salir={salir} />
          <SidebarInset className="min-w-0">
            <BarraSuperior d={d} />
            <div className="flex-1 pb-20 md:pb-0">{children}</div>
          </SidebarInset>
          {d.asistente && <Asistente />}
          <BarraMovil d={d} />
          <Comandos d={d} />
          <Toaster position="bottom-right" />
        </SidebarProvider>
      </TooltipProvider>
    </ProveedorShell>
  );
}

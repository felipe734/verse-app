"use client";

import { Bell, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useMontado } from "@/hooks/use-montado";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShell } from "./contexto";
import type { DatosShell } from "./tipos";

const ID_ACCIONES = "acciones-modulo";

/** Un módulo pone sus acciones en la barra superior con este componente. */
export function AccionesModulo({ children }: { children: React.ReactNode }) {
  const montado = useMontado();
  const destino = montado ? document.getElementById(ID_ACCIONES) : null;
  return destino ? createPortal(children, destino) : null;
}

function Ruta({ d }: { d: DatosShell }) {
  const ruta = usePathname();
  const grupo = d.grupos.find((g) => g.items.some((i) => ruta === i.href || ruta.startsWith(`${i.href}/`)));
  const item = grupo?.items.find((i) => ruta === i.href || ruta.startsWith(`${i.href}/`));
  const partes = ruta.startsWith("/ajustes")
    ? [{ texto: "Ajustes", href: "/ajustes" }]
    : [
        { texto: d.empresa?.nombre ?? "Todas", href: null },
        grupo ? { texto: grupo.nombre, href: null } : null,
        item ? { texto: item.nombre, href: item.href } : null,
      ].filter(Boolean);
  return (
    <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1 text-sm">
      {partes.map((p, i) => {
        const ultima = i === partes.length - 1;
        return (
          <span key={i} className={`flex min-w-0 items-center gap-1 ${ultima ? "" : "max-md:hidden"}`}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground max-md:hidden" aria-hidden />}
            {ultima && p!.href ? (
              <Link href={p!.href} aria-current="page" className="truncate font-medium text-foreground">
                {p!.texto}
              </Link>
            ) : (
              <span className="truncate text-muted-foreground">{p!.texto}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function Avisos({ d }: { d: DatosShell }) {
  const hoy = d.grupos.flatMap((g) => g.items).find((i) => i.tipo === "hoy");
  const aprobar = d.grupos.flatMap((g) => g.items).find((i) => i.tipo === "aprobar");
  const total = d.contadores.criticos + d.contadores.aprobar;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative size-8" aria-label={total ? `Avisos, ${total} por mirar` : "Avisos"}>
              <Bell className="size-4" aria-hidden />
              {total > 0 && <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-acento" />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Avisos</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Avisos</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {total === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Nada urgente por ahora.</p>}
        {d.contadores.criticos > 0 && hoy && (
          <DropdownMenuItem asChild>
            <Link href={hoy.href} className="flex justify-between">
              <span>Pendientes críticos</span>
              <span className="tabular-nums text-muted-foreground">{d.contadores.criticos}</span>
            </Link>
          </DropdownMenuItem>
        )}
        {d.contadores.aprobar > 0 && aprobar && (
          <DropdownMenuItem asChild>
            <Link href={aprobar.href} className="flex justify-between">
              <span>Cambios para aprobar</span>
              <span className="tabular-nums text-muted-foreground">{d.contadores.aprobar}</span>
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Barra superior: menú, ruta, acciones del módulo, avisos y asistente. */
export function BarraSuperior({ d }: { d: DatosShell }) {
  const { alternarAsistente, asistente, asistenteHabilitado } = useShell();
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-4">
      <SidebarTrigger className="-ml-1" aria-label="Abrir o cerrar el menú" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <Ruta d={d} />
      <div id={ID_ACCIONES} className="ml-auto flex items-center gap-2" />
      <Avisos d={d} />
      {asistenteHabilitado && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={asistente ? "secondary" : "outline"} size="sm" className="h-8 gap-1.5 max-md:hidden" onClick={alternarAsistente} aria-pressed={asistente}>
              <Sparkles className="size-4" aria-hidden />
              Asistente
              <Kbd>⌘J</Kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Abrir el asistente</TooltipContent>
        </Tooltip>
      )}
    </header>
  );
}

"use client";

import { Check, ChevronRight, ChevronsUpDown, House, LogOut, Monitor, Moon, Search, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { TODAS } from "@/lib/modulos/registro";
import { useShell } from "./contexto";
import { Icono } from "./iconos";
import { LogoEmpresa } from "./logo-empresa";
import type { DatosShell } from "./tipos";

const CLAVE_PLEGADAS = "verse-menu-plegadas";

/** Verticales plegadas en la barra lateral, recordadas en este navegador. */
function usePlegadas(): [Record<string, boolean>, (vertical: string, plegada: boolean) => void] {
  const [plegadas, setPlegadas] = useState<Record<string, boolean>>({});
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const guardado = JSON.parse(localStorage.getItem(CLAVE_PLEGADAS) ?? "{}") as Record<string, boolean>;
        setPlegadas(guardado);
      } catch {
        /* sin almacenamiento: todo con su valor por defecto */
      }
    });
  }, []);
  const plegar = (vertical: string, plegada: boolean) =>
    setPlegadas((p) => {
      const n = { ...p, [vertical]: plegada };
      try {
        localStorage.setItem(CLAVE_PLEGADAS, JSON.stringify(n));
      } catch {
        /* sin almacenamiento */
      }
      return n;
    });
  return [plegadas, plegar];
}

function SelectorEmpresa({ d }: { d: DatosShell }) {
  const router = useRouter();
  const ruta = usePathname();
  const enHoy = /\/general\/hoy$/.test(ruta);
  const activa = d.empresa;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" aria-label="Cambiar de empresa">
          {activa ? (
            <LogoEmpresa nombre={activa.nombre} logo={activa.logo} acento={activa.acento} className="size-8" />
          ) : (
            <span aria-hidden className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-[12px] font-semibold text-sidebar-primary-foreground">
              {d.plataforma.charAt(0)}
            </span>
          )}
          <span className="grid flex-1 text-left leading-tight">
            <span className="truncate text-sm font-semibold">{activa?.nombre ?? "Todas las empresas"}</span>
            <span className="truncate text-xs text-muted-foreground">{d.plataforma}</span>
          </span>
          <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" aria-hidden />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="start" sideOffset={4}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Empresas</DropdownMenuLabel>
        {d.empresas.map((e) => (
          <DropdownMenuItem key={e.id} onSelect={() => router.push(e.inicio)} className="gap-2">
            <LogoEmpresa nombre={e.nombre} logo={e.logo} acento={e.acento} />
            <span className="flex-1 truncate">{e.nombre}</span>
            {activa?.id === e.id && <Check className="size-4" aria-hidden />}
          </DropdownMenuItem>
        ))}
        {d.todas && (enHoy || !activa) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push(`/${TODAS}/general/hoy`)} className="gap-2">
              <span aria-hidden className="flex size-6 items-center justify-center rounded-md border text-[11px]">
                ∗
              </span>
              <span className="flex-1">Todas, en Hoy</span>
              {!activa && <Check className="size-4" aria-hidden />}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuUsuario({ d, salir }: { d: DatosShell; salir: () => Promise<void> }) {
  const { theme, setTheme } = useTheme();
  const iniciales = d.usuario.nombre
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" aria-label="Menú de usuario">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-muted text-[12px] font-medium">
            {iniciales || "·"}
          </span>
          <span className="grid flex-1 text-left leading-tight">
            <span className="truncate text-sm font-medium">{d.usuario.nombre}</span>
            <span className="truncate text-xs text-muted-foreground">{d.usuario.maestro ? "Maestro" : d.usuario.correo}</span>
          </span>
          <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" aria-hidden />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" side="top" align="start" sideOffset={4}>
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{d.usuario.correo}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" aria-hidden /> Claro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" aria-hidden /> Oscuro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" aria-hidden /> Del sistema
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void salir()}>
          <LogOut className="size-4" aria-hidden /> Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Barra lateral: selector de empresa, búsqueda, módulos por vertical, Ajustes y usuario. */
export function BarraLateral({ d, salir }: { d: DatosShell; salir: () => Promise<void> }) {
  const ruta = usePathname();
  const { setComandos } = useShell();
  const { setOpenMobile, isMobile, state } = useSidebar();
  const [plegadas, plegar] = usePlegadas();
  const cerrarEnCelular = () => isMobile && setOpenMobile(false);
  const contador = (c?: string) => (c === "hoy" ? d.contadores.hoy : c === "aprobar" ? d.contadores.aprobar : 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SelectorEmpresa d={d} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setComandos(true)} tooltip="Buscar (⌘K)" className="text-muted-foreground">
              <Search className="size-4" aria-hidden />
              <span className="flex-1">Buscar</span>
              <Kbd className="group-data-[collapsible=icon]:hidden">⌘K</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={ruta === "/inicio"}
              tooltip="Inicio"
              className="data-[active=true]:bg-acento-suave data-[active=true]:font-medium data-[active=true]:text-foreground [&[data-active=true]>svg]:text-acento"
            >
              <Link href="/inicio" onClick={cerrarEnCelular} aria-current={ruta === "/inicio" ? "page" : undefined}>
                <House className="size-4" aria-hidden />
                <span>Inicio</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {d.grupos.map((g) => {
          const conActivo = g.items.some((i) => ruta === i.href || ruta.startsWith(`${i.href}/`));
          // Con la barra en íconos no hay títulos que tocar: todo abierto.
          const abierto = state === "collapsed" || conActivo || (plegadas[g.vertical] === undefined ? g.vertical.endsWith("-general") : !plegadas[g.vertical]);
          return (
            <Collapsible key={g.vertical} open={abierto} onOpenChange={(v) => plegar(g.vertical, !v)} asChild>
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="group/titulo flex w-full items-center gap-1 hover:text-sidebar-foreground" disabled={conActivo}>
                    <span className="flex-1 text-left">{g.nombre}</span>
                    {!conActivo && <ChevronRight className="size-3.5 transition-transform group-data-[state=open]/titulo:rotate-90" aria-hidden />}
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarMenu>
                    {g.items.map((i) => {
                      const activo = ruta === i.href || ruta.startsWith(`${i.href}/`);
                      const n = contador(i.contador);
                      return (
                        <SidebarMenuItem key={i.id}>
                          <SidebarMenuButton
                            asChild
                            isActive={activo}
                            tooltip={i.nombre}
                            className="data-[active=true]:bg-acento-suave data-[active=true]:font-medium data-[active=true]:text-foreground [&[data-active=true]>svg]:text-acento"
                          >
                            <Link href={i.href} onClick={cerrarEnCelular} aria-current={activo ? "page" : undefined}>
                              <Icono nombre={i.icono} className="size-4" />
                              <span>{i.nombre}</span>
                            </Link>
                          </SidebarMenuButton>
                          {n > 0 && <SidebarMenuBadge className="tabular-nums text-muted-foreground">{n}</SidebarMenuBadge>}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
        {d.grupos.length === 0 && <p className="px-4 py-2 text-sm text-muted-foreground">Todavía no tienes módulos aquí.</p>}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {d.ajustes && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={ruta.startsWith("/ajustes")} tooltip="Ajustes">
                <Link href="/ajustes" onClick={cerrarEnCelular}>
                  <Settings className="size-4" aria-hidden />
                  <span>Ajustes</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <MenuUsuario d={d} salir={salir} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

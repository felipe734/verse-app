"use client";

import { Menu, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useMontado } from "@/hooks/use-montado";
import { useSidebar } from "@/components/ui/sidebar";
import type { ItemNav } from "@/lib/modulos/registro";
import { useShell } from "./contexto";
import { Icono } from "./iconos";
import type { DatosShell } from "./tipos";

const CLAVE = "modulos-usados";

function leerUsos(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** Celular: Hoy, Correo, Asistente, el módulo más usado y Más (abre el menú). */
export function BarraMovil({ d }: { d: DatosShell }) {
  const ruta = usePathname();
  const { setOpenMobile } = useSidebar();
  const { abrirAsistente, asistenteHabilitado } = useShell();
  const items = d.grupos.flatMap((g) => g.items);
  const montado = useMontado();
  const usos = montado ? leerUsos() : {};

  useEffect(() => {
    const actual = items.find((i) => ruta === i.href || ruta.startsWith(`${i.href}/`));
    if (!actual) return;
    const u = leerUsos();
    u[actual.href] = (u[actual.href] ?? 0) + 1;
    try {
      localStorage.setItem(CLAVE, JSON.stringify(u));
    } catch {
      /* sin almacenamiento: la barra usa el orden por defecto */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta]);

  const hoy = items.find((i) => i.tipo === "hoy");
  const correo = items.find((i) => i.tipo === "correo");
  const fijos = new Set([hoy?.href, correo?.href]);
  const usado: ItemNav | undefined = items.filter((i) => !fijos.has(i.href)).sort((a, b) => (usos[b.href] ?? 0) - (usos[a.href] ?? 0))[0];

  const enlace = (i: ItemNav | undefined) =>
    i ? (
      <Link
        href={i.href}
        aria-current={ruta.startsWith(i.href) ? "page" : undefined}
        className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground aria-[current=page]:text-foreground [&[aria-current=page]>svg]:text-acento"
      >
        <Icono nombre={i.icono} className="size-5" />
        <span className="max-w-[72px] truncate">{i.nombre}</span>
      </Link>
    ) : null;

  return (
    <nav aria-label="Accesos" className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {enlace(hoy)}
      {enlace(correo)}
      {asistenteHabilitado && (
        <button type="button" onClick={() => abrirAsistente()} className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground">
          <span className="flex size-9 -mt-3 items-center justify-center rounded-full bg-acento text-acento-foreground shadow-sm">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <span>Asistente</span>
        </button>
      )}
      {enlace(usado)}
      <button type="button" onClick={() => setOpenMobile(true)} className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground">
        <Menu className="size-5" aria-hidden />
        <span>Más</span>
      </button>
    </nav>
  );
}

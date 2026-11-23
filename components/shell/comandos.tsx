"use client";

import { Building2, CheckSquare, FileText, Home, MessageSquare, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buscar } from "@/app/shell/acciones";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import type { Resultado } from "@/lib/buscar/global";
import { useShell } from "./contexto";
import { Icono } from "./iconos";
import { LogoEmpresa } from "./logo-empresa";
import type { DatosShell } from "./tipos";

const ICONO_RESULTADO = { pendiente: CheckSquare, unidad: Building2, reserva: Home, registro: FileText } as const;

/** Paleta de comandos (⌘K): ir a un módulo, buscar pendiente, unidad o reserva, cambiar de empresa. */
export function Comandos({ d }: { d: DatosShell }) {
  const { comandos, setComandos, abrirAsistente, asistenteHabilitado } = useShell();
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, iniciar] = useTransition();

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => iniciar(async () => setResultados(await buscar(q))), 300);
    return () => clearTimeout(t);
  }, [texto]);

  function ir(href: string) {
    setComandos(false);
    setTexto("");
    router.push(href);
  }

  const visibles = texto.trim().length < 2 ? [] : resultados;

  return (
    <CommandDialog open={comandos} onOpenChange={setComandos} title="Buscar" description="Ir a un módulo, buscar o cambiar de empresa">
      <CommandInput placeholder="Busca un módulo, pendiente, unidad o reserva" value={texto} onValueChange={setTexto} />
      <CommandList>
        <CommandEmpty>{buscando ? "Buscando" : "Sin resultados."}</CommandEmpty>
        {visibles.length > 0 && (
          <CommandGroup heading="Resultados">
            {visibles.map((r) => {
              const I = ICONO_RESULTADO[r.tipo];
              return (
                <CommandItem
                  key={`${r.tipo}-${r.id}`}
                  value={`${r.tipo} ${r.titulo} ${r.detalle} ${r.id}`}
                  onSelect={() => {
                    if (r.href) ir(r.href);
                    else if (r.pregunta && asistenteHabilitado) {
                      setComandos(false);
                      abrirAsistente(r.pregunta);
                    }
                  }}
                >
                  <I className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{r.titulo}</span>
                    <span className="truncate text-xs text-muted-foreground">{r.detalle}</span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        {d.modulosPorEmpresa.map((e) => (
          <CommandGroup key={e.empresa} heading={e.nombre}>
            {e.grupos.flatMap((g) =>
              g.items.map((i) => (
                <CommandItem key={i.href} value={`${e.nombre} ${g.nombre} ${i.nombre}`} onSelect={() => ir(i.href)}>
                  <Icono nombre={i.icono} className="size-4 text-muted-foreground" />
                  <span>{i.nombre}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{g.nombre}</span>
                </CommandItem>
              )),
            )}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Cambiar de empresa">
          {d.empresas.map((e) => (
            <CommandItem key={e.id} value={`empresa ${e.nombre}`} onSelect={() => ir(e.inicio)}>
              <LogoEmpresa nombre={e.nombre} logo={e.logo} acento={e.acento} className="size-5" />
              <span>{e.nombre}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {asistenteHabilitado && texto.trim().length >= 2 && (
          <CommandGroup heading="Asistente">
            <CommandItem
              value={`asistente ${texto}`}
              onSelect={() => {
                setComandos(false);
                abrirAsistente(texto.trim());
                setTexto("");
              }}
            >
              <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
              <span className="truncate">Preguntar al asistente: {texto.trim()}</span>
            </CommandItem>
          </CommandGroup>
        )}
        {texto.trim().length < 2 && (
          <p className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <Search className="size-3.5" aria-hidden /> Escribe dos letras para buscar pendientes, unidades y reservas.
          </p>
        )}
      </CommandList>
    </CommandDialog>
  );
}

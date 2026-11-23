"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface Shell {
  asistente: boolean;
  /** Abre el asistente; con texto, lo deja escrito para enviarlo. */
  abrirAsistente: (texto?: string) => void;
  cerrarAsistente: () => void;
  alternarAsistente: () => void;
  /** Lo escrito en el asistente; abrirlo con texto lo deja aquí. */
  borrador: string;
  setBorrador: (t: string | ((t: string) => string)) => void;
  comandos: boolean;
  setComandos: (v: boolean) => void;
  asistenteHabilitado: boolean;
}

const Ctx = createContext<Shell | null>(null);

export function useShell(): Shell {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShell fuera del shell");
  return c;
}

/** Estado compartido del shell: paleta de comandos (⌘K) y panel del asistente (⌘J). */
export function ProveedorShell({ asistenteHabilitado, children }: { asistenteHabilitado: boolean; children: React.ReactNode }) {
  const [asistente, setAsistente] = useState(false);
  const [comandos, setComandos] = useState(false);
  const [borrador, setBorrador] = useState("");

  const abrirAsistente = useCallback(
    (texto?: string) => {
      if (!asistenteHabilitado) return;
      if (texto) setBorrador(texto);
      setAsistente(true);
    },
    [asistenteHabilitado],
  );

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        setComandos((v) => !v);
      } else if (k === "j" && asistenteHabilitado) {
        e.preventDefault();
        setAsistente((v) => !v);
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [asistenteHabilitado]);

  const valor = useMemo<Shell>(
    () => ({
      asistente,
      abrirAsistente,
      cerrarAsistente: () => setAsistente(false),
      alternarAsistente: () => setAsistente((v) => !v),
      borrador,
      setBorrador,
      comandos,
      setComandos,
      asistenteHabilitado,
    }),
    [asistente, abrirAsistente, borrador, comandos, asistenteHabilitado],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

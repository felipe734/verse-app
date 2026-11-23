"use client";

import { ThemeProvider } from "next-themes";

/** Claro, oscuro o el del sistema; se guarda por navegador. */
export function Tema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}

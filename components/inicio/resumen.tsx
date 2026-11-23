import { Sparkles } from "lucide-react";
import type { Sesion } from "@/lib/acceso/permisos";
import { resumenDelDia } from "@/lib/asistente/resumen";
import { leerAlertas } from "./alertas";

/** Tres líneas con lo importante de hoy. Sin clave de Claude o sin datos, no aparece. */
export async function ResumenDia({ sesion, nombre, base }: { sesion: Sesion; nombre: string; base: string }) {
  const alertas = await leerAlertas(sesion);
  const contexto = [base, ...alertas.map((a) => `Alerta: ${a.titulo} (${a.detalle})`)].filter(Boolean).join("\n");
  const texto = await resumenDelDia(sesion.usuarioId, nombre, contexto).catch((e) => {
    console.error("[resumen]", e instanceof Error ? e.message : e);
    return null;
  });
  if (!texto) return null;
  return (
    <section aria-label="Resumen del día" className="flex gap-3 rounded-lg border bg-acento-suave/40 p-4">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-acento" aria-hidden />
      <p className="text-sm leading-relaxed whitespace-pre-line">{texto}</p>
    </section>
  );
}

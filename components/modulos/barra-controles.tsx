import { cn } from "@/lib/utils";

/**
 * Fila única de controles de un módulo, en la misma línea del contenido (no en la barra
 * superior, que es solo para lo transversal: avisos y asistente). Mismo orden en toda la app:
 * a la izquierda período y filtros; a la derecha buscar, vista y acciones.
 */
export function BarraControles({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-3 flex flex-wrap items-center gap-2 print:hidden", className)}>{children}</div>;
}

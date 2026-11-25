import { cn } from "@/lib/utils";
import { CLASE_TONO, tonoDe } from "@/lib/vistas/tono";

/** Estado con su color por significado (lib/vistas/tono.ts). */
export function Estado({ valor, className }: { valor: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", CLASE_TONO[tonoDe(valor)], className)}>
      <i aria-hidden className="size-1.5 shrink-0 rounded-full" />
      {valor}
    </span>
  );
}

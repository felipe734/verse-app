import { ExternalLink } from "lucide-react";
import { enlaceDe } from "@/lib/modulos/enlace";

/** Botón para abrir un archivo o enlace de Airtable (Drive, soporte, extracto) en otra pestaña. */
export function BotonEnlace({ valor }: { valor: string }) {
  const e = enlaceDe(valor);
  if (!e) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={e.url}
      target="_blank"
      rel="noreferrer"
      onClick={(ev) => ev.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium hover:bg-muted"
    >
      <ExternalLink className="size-3" aria-hidden /> {e.drive ? "Abrir en Drive" : "Abrir"}
    </a>
  );
}

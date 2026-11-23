import { AlertTriangle, ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import { db } from "@/db/cliente";
import type { Sesion } from "@/lib/acceso/permisos";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { alertasDe, type Alerta } from "@/lib/alertas/operacion";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";
import { cn } from "@/lib/utils";

export async function leerAlertas(sesion: Sesion, modulo?: string): Promise<Alerta[]> {
  const contador = crearContador();
  const r = await alertasDe({ airtable: clienteServidor(contador), s: sesion, estructura: sesion.estructura ?? ESTRUCTURA, hoy: hoyBogota(), db: db() }, modulo).catch(() => []);
  await contador.volcar(db()).catch(() => undefined);
  return r;
}

export function ListaAlertas({ alertas, compacta }: { alertas: Alerta[]; compacta?: boolean }) {
  if (!alertas.length) return null;
  return (
    <section aria-label="Alertas" className={cn("space-y-2", compacta && "mb-4")}>
      {!compacta && <h2 className="text-sm font-semibold">Alertas</h2>}
      <ul className="space-y-1.5">
        {alertas.map((a) => (
          <li key={a.id}>
            <Link
              href={a.href}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm hover:border-foreground/20",
                a.nivel === "alta" ? "border-destructive/30 bg-destructive/5" : "bg-card",
              )}
            >
              {a.nivel === "alta" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="font-medium">{a.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{a.detalle}</span>
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Para Inicio: se carga por su cuenta y no frena la página. */
export async function AlertasInicio({ sesion }: { sesion: Sesion }) {
  return <ListaAlertas alertas={await leerAlertas(sesion)} />;
}

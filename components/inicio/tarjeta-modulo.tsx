import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { db } from "@/db/cliente";
import type { Sesion } from "@/lib/acceso/permisos";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { calcularIndicadores } from "@/lib/modulos/indicadores";
import { leerTabla, type DefTabla } from "@/lib/modulos/tabla";
import { clienteServidor } from "@/lib/servidor/airtable";
import { periodoInicial } from "@/lib/vistas/periodo";
import { Icono } from "@/components/shell/iconos";

/** "$ 269.000.000" → "$ 269 M" para que quepa en la tarjeta; lo demás igual. */
const corto = (v: string) => {
  const m = v.match(/^(-?)\$\s?([\d.]+)$/);
  if (!m) return v;
  const n = Number(m[2]!.replaceAll(".", ""));
  if (n < 10_000_000) return v;
  return `${m[1]}$ ${(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: n < 100_000_000 ? 1 : 0 })} M`;
};

/** Tarjeta de Inicio: el módulo con sus primeras cifras del período actual. Lee Airtable en el momento. */
export async function TarjetaModulo({ sesion, empresa, vertical, nombre, icono, href, def }: { sesion: Sesion; empresa: string; vertical: string; nombre: string; icono: string; href: string; def: DefTabla }) {
  const hoy = hoyBogota();
  const periodo = def.periodo ? periodoInicial(def.periodo, undefined, hoy) : undefined;
  let cifras: { etiqueta: string; valor: string }[] = [];
  let error = false;
  try {
    const contador = crearContador();
    const r = await leerTabla(clienteServidor(contador), sesion, empresa, vertical, def, hoy, periodo);
    await contador.volcar(db());
    cifras = calcularIndicadores(def.indicadores ?? [], r.columnas, r.filas).slice(0, 3);
  } catch (e) {
    console.error(`[inicio/${href}]`, e instanceof Error ? e.message : e);
    error = true;
  }
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20">
      <div className="flex items-center gap-2">
        <Icono nombre={icono} className="size-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium">{nombre}</span>
        {periodo && <span className="text-xs text-muted-foreground first-letter:uppercase">{periodo.etiqueta}</span>}
        <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </div>
      {error ? (
        <p className="text-xs text-muted-foreground">Airtable no respondió</p>
      ) : (
        <dl className="grid grid-cols-3 gap-2">
          {cifras.map((c) => (
            <div key={c.etiqueta} className="min-w-0">
              <dt className="truncate text-xs text-muted-foreground">{c.etiqueta}</dt>
              <dd className="truncate text-base font-semibold tabular-nums" title={c.valor}>
                {corto(c.valor)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Link>
  );
}

export function EsqueletoTarjeta() {
  return <div className="h-[106px] animate-pulse rounded-lg border bg-muted/50" aria-hidden />;
}

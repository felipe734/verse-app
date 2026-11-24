import Link from "next/link";
import { db } from "@/db/cliente";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { pulsoHost, type DiaPulso, type Movimiento, type PulsoHost } from "@/lib/pulso/host";
import { clienteServidor } from "@/lib/servidor/airtable";
import { cn } from "@/lib/utils";

const nombres = (xs: Movimiento[], n = 3) => {
  const t = xs.slice(0, n).map((x) => (x.hora ? `${x.unidad} ${x.hora}` : x.unidad));
  return xs.length > n ? `${t.join(", ")} y ${xs.length - n} más` : t.join(", ");
};

function Cifra({ titulo, valor, detalle, href, alerta }: { titulo: string; valor: string; detalle?: string; href: string; alerta?: boolean }) {
  return (
    <Link href={href} className={cn("min-w-0 rounded-lg border bg-card px-4 py-3 hover:border-foreground/20", alerta && "border-destructive/30 bg-destructive/5")}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", alerta && "text-destructive")}>{valor}</p>
      {detalle && <p className="truncate text-xs text-muted-foreground">{detalle}</p>}
    </Link>
  );
}

function Fila({ etiqueta, d }: { etiqueta: string; d: DiaPulso }) {
  const partes = [
    d.entradas.length ? `Entran ${nombres(d.entradas)}` : null,
    d.salidas.length ? `Salen ${nombres(d.salidas)}` : null,
  ].filter(Boolean);
  return (
    <li className="flex gap-3 text-sm">
      <span className="w-16 shrink-0 text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0">{partes.length ? partes.join(" · ") : "Sin entradas ni salidas"}</span>
    </li>
  );
}

export function VistaPulso({ p }: { p: PulsoHost }) {
  const pct = p.activas ? Math.round((p.ocupadas / p.activas) * 100) : null;
  const aseos = p.hoy.aseos;
  const sin = aseos?.sinFuncionaria.length ?? 0;
  const sinManana = p.manana.aseos?.sinFuncionaria.length ?? 0;
  return (
    <section aria-label="Pulso de Verse Host" className="space-y-3">
      <h2 className="text-sm font-semibold">Pulso de Host</h2>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Cifra titulo="Ocupación hoy" valor={pct === null ? String(p.ocupadas) : `${pct}%`} detalle={p.activas ? `${p.ocupadas} de ${p.activas} unidades` : "unidades ocupadas"} href={p.enlaces.operacion} />
        <Cifra titulo="Entradas hoy" valor={String(p.hoy.entradas.length)} detalle={`Mañana ${p.manana.entradas.length}`} href={p.enlaces.operacion} />
        <Cifra titulo="Salidas hoy" valor={String(p.hoy.salidas.length)} detalle={`Mañana ${p.manana.salidas.length}`} href={p.enlaces.operacion} />
        {aseos && p.enlaces.limpiezas ? (
          <Cifra
            titulo="Aseos hoy"
            valor={`${aseos.terminados}/${aseos.total}`}
            detalle={sin ? `${sin} sin aseadora` : sinManana ? `Mañana ${sinManana} sin aseadora` : `Mañana ${p.manana.aseos?.total ?? 0}`}
            href={p.enlaces.limpiezas}
            alerta={sin > 0 || sinManana > 0}
          />
        ) : null}
      </div>
      {(p.hoy.entradas.length + p.hoy.salidas.length + p.manana.entradas.length + p.manana.salidas.length > 0) && (
        <ul className="space-y-1.5 rounded-lg border bg-card px-4 py-3">
          <Fila etiqueta="Hoy" d={p.hoy} />
          <Fila etiqueta="Mañana" d={p.manana} />
        </ul>
      )}
    </section>
  );
}

/** Para Inicio: se carga por su cuenta y no frena la página. Si falla, no aparece. */
export async function PulsoInicio({ sesion }: { sesion: Sesion }) {
  const contador = crearContador();
  const p = await pulsoHost({ airtable: clienteServidor(contador), s: sesion, estructura: sesion.estructura ?? ESTRUCTURA, hoy: hoyBogota() }).catch((e) => {
    console.error("[pulso]", e instanceof Error ? e.message : e);
    return null;
  });
  await contador.volcar(db()).catch(() => undefined);
  return p ? <VistaPulso p={p} /> : null;
}

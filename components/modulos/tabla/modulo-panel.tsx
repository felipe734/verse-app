import Link from "next/link";
import type { Sesion } from "@/lib/acceso/permisos";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { leerCierre, pestanaDe, type MesCierre } from "@/lib/modulos/finanzas";
import type { Ubicacion } from "@/lib/modulos/registro";
import { leerTabla, type ResultadoTabla } from "@/lib/modulos/tabla";
import { db } from "@/db/cliente";
import { clienteServidor } from "@/lib/servidor/airtable";
import { cn } from "@/lib/utils";
import { EncabezadoModulo } from "../encabezado";
import { VistaTabla } from "./vista-tabla";

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function Indicador({ etiqueta, valor, antes }: { etiqueta: string; valor: number | null; antes: number | null }) {
  const cambio = valor !== null && antes ? (valor - antes) / Math.abs(antes) : null;
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor === null ? "—" : pesos.format(valor)}</p>
      {cambio !== null && (
        <p className={cn("text-xs tabular-nums", cambio >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {cambio >= 0 ? "+" : ""}
          {(cambio * 100).toFixed(1)}% vs. mes anterior
        </p>
      )}
    </div>
  );
}

function Cierre({ meses }: { meses: MesCierre[] }) {
  const [actual, anterior] = meses;
  if (!actual) return null;
  return (
    <section aria-label="Cierre del mes" className="space-y-2 px-4 pb-4 md:px-6">
      <p className="text-sm font-medium">Cierre de {nombreMes(actual.mes)}</p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Indicador etiqueta="Ingresos" valor={actual.ingresos} antes={anterior?.ingresos ?? null} />
        <Indicador etiqueta="Contribución" valor={actual.contribucion} antes={anterior?.contribucion ?? null} />
        <Indicador etiqueta="Overhead" valor={actual.overhead} antes={anterior?.overhead ?? null} />
        <Indicador etiqueta="Margen neto" valor={actual.margen} antes={anterior?.margen ?? null} />
      </div>
    </section>
  );
}

/** Módulo con pestañas (Finanzas): cada pestaña es una tabla de Airtable; se lee solo la abierta. */
export async function ModuloPanel({ sesion, u, pestana }: { sesion: Sesion; u: Ubicacion; pestana?: string }) {
  const lista = u.def.pestanas!;
  const activa = pestanaDe(u.def.tipo, pestana)!;
  const ruta = `/${u.empresa}/${u.vertical.segmento}/${u.def.segmento}`;
  const contador = crearContador();
  const airtable = clienteServidor(contador);
  let r: ResultadoTabla | null = null;
  let cierre: MesCierre[] | null = null;
  let error: string | undefined;
  try {
    [r, cierre] = await Promise.all([
      leerTabla(airtable, sesion, u.empresa, u.vertical.id, activa.tabla, hoyBogota()),
      u.def.tipo === "finanzas" ? leerCierre(airtable, sesion) : Promise.resolve(null),
    ]);
    await contador.volcar(db());
  } catch (e) {
    console.error(`[modulo/${u.def.tipo}/${activa.id}]`, e instanceof Error ? e.message : e);
    error = "Airtable no respondió. Intenta de nuevo en un momento.";
  }
  return (
    <>
      <EncabezadoModulo titulo={u.modulo.nombre} descripcion={u.def.descripcion} />
      {cierre && <Cierre meses={cierre} />}
      <nav aria-label={`Secciones de ${u.modulo.nombre}`} className="flex gap-1 overflow-x-auto border-b px-4 md:px-6">
        {lista.map((p) => (
          <Link
            key={p.id}
            href={`${ruta}?pestana=${p.id}`}
            aria-current={p.id === activa.id ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              p.id === activa.id ? "border-acento font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {p.nombre}
          </Link>
        ))}
      </nav>
      <div className="h-4" aria-hidden />
      <VistaTabla
        key={activa.id}
        titulo={activa.nombre}
        modulo={`${u.modulo.nombre} · ${activa.nombre}`}
        columnas={r?.columnas ?? activa.tabla.columnas}
        detalle={r?.detalle ?? []}
        filas={r?.filas ?? []}
        ocultos={r?.ocultos ?? []}
        vacio={activa.tabla.vacio}
        error={error}
      />
    </>
  );
}

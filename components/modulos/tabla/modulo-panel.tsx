import Link from "next/link";
import { alcanceHoy, puede, type Sesion } from "@/lib/acceso/permisos";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { cronometro, registrarTiempo } from "@/lib/medicion/uso";
import { leerCierre, pestanaDe, type MesCierre } from "@/lib/modulos/finanzas";
import type { Ubicacion } from "@/lib/modulos/registro";
import { leerTabla, type ResultadoTabla } from "@/lib/modulos/tabla";
import { db } from "@/db/cliente";
import { clienteServidor } from "@/lib/servidor/airtable";
import { subidasActivas } from "@/lib/servidor/blob";
import { cn } from "@/lib/utils";
import { EncabezadoModulo } from "../encabezado";
import { CrearFila } from "./crear-fila";
import { campoPorNombre } from "@/lib/modulos/editar";
import { periodoInicial } from "@/lib/vistas/periodo";
import { vistasDe } from "@/lib/vistas/guardadas";
import { leerAlertas, ListaAlertas } from "@/components/inicio/alertas";
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

function Cierre({ meses, mes }: { meses: MesCierre[]; mes?: string }) {
  // El cierre del mes elegido; si todavía no existe (se llena el día 5), el último cerrado.
  const i = Math.max(0, mes ? meses.findIndex((m) => m.mes === mes) : 0);
  const [actual, anterior] = [meses[i], meses[i + 1]];
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
      <Tendencia meses={meses.slice(i, i + 6).reverse()} />
    </section>
  );
}

/** Seis meses de ingresos y margen neto, en barras. La tabla de abajo es la versión accesible. */
function Tendencia({ meses }: { meses: MesCierre[] }) {
  if (meses.length < 2) return null;
  const max = Math.max(1, ...meses.map((m) => Math.abs(m.ingresos ?? 0)));
  const millones = (v: number | null) => (v === null ? "—" : `${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`);
  return (
    <figure className="rounded-lg border bg-card p-3">
      <figcaption className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        Últimos {meses.length} meses
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-muted-foreground/40" aria-hidden /> Ingresos
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-acento" aria-hidden /> Margen neto
        </span>
      </figcaption>
      <div className="flex h-28 items-end gap-3" aria-hidden>
        {meses.map((m) => (
          <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end justify-center gap-1">
              <div className="w-1/3 rounded-t bg-muted-foreground/40" style={{ height: `${(Math.abs(m.ingresos ?? 0) / max) * 100}%` }} />
              <div className={cn("w-1/3 rounded-t", (m.margen ?? 0) < 0 ? "bg-destructive" : "bg-acento")} style={{ height: `${(Math.abs(m.margen ?? 0) / max) * 100}%` }} />
            </div>
            <span className="text-[11px] text-muted-foreground">{nombreMes(m.mes).split(" ")[0]}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Ingresos y margen neto por mes</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Ingresos</th>
            <th>Margen neto</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.mes}>
              <td>{nombreMes(m.mes)}</td>
              <td>{millones(m.ingresos)}</td>
              <td>{millones(m.margen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Módulo con pestañas (Finanzas): cada pestaña es una tabla de Airtable; se lee solo la abierta. */
export async function ModuloPanel({ sesion, u, pestana, p }: { sesion: Sesion; u: Ubicacion; pestana?: string; p?: string }) {
  const transcurrido = cronometro();
  const lista = u.def.pestanas!;
  const activa = pestanaDe(u.def.tipo, pestana)!;
  const puedeEditar = Boolean(activa.tabla.editar?.campos.length) && puede(sesion, u.empresa, u.modulo.id, "editar");
  const ruta = `/${u.empresa}/${u.vertical.segmento}/${u.def.segmento}`;
  const hoy = hoyBogota();
  const periodo = activa.tabla.periodo ? periodoInicial(activa.tabla.periodo, p, hoy) : undefined;
  const contador = crearContador();
  const airtable = clienteServidor(contador);
  let r: ResultadoTabla | null = null;
  let cierre: MesCierre[] | null = null;
  let error: string | undefined;
  // Alertas y vistas guardadas en paralelo con Airtable.
  const extras = Promise.all([leerAlertas(sesion, u.def.tipo), vistasDe(db(), sesion.usuarioId, ruta).catch(() => [])]);
  try {
    [r, cierre] = await Promise.all([
      leerTabla(airtable, sesion, u.empresa, u.vertical.id, activa.tabla, hoy, periodo),
      u.def.tipo === "finanzas" ? leerCierre(airtable, sesion, 13) : Promise.resolve(null),
    ]);
    await contador.volcar(db());
  } catch (e) {
    console.error(`[modulo/${u.def.tipo}/${activa.id}]`, e instanceof Error ? e.message : e);
    error = "Airtable no respondió. Intenta de nuevo en un momento.";
  }
  const [alertas, vistas] = await extras;
  await registrarTiempo(db(), sesion.usuarioId, ruta, hoy, transcurrido());
  return (
    <>
      <EncabezadoModulo titulo={u.modulo.nombre} descripcion={u.def.descripcion}>
        {activa.crear && puede(sesion, u.empresa, u.modulo.id, "editar") && (
          <CrearFila
            refModulo={{ empresa: u.empresa, vertical: u.vertical.segmento, modulo: u.def.segmento, pestana: activa.id }}
            titulo={activa.crear.titulo}
            subidas={subidasActivas()}
          />
        )}
      </EncabezadoModulo>
      <div className="px-4 md:px-6">
        <ListaAlertas alertas={alertas} compacta />
      </div>
      {cierre && <Cierre meses={cierre} mes={periodo?.unidad === "mes" ? periodo.clave : undefined} />}
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
        periodo={periodo}
        filtros={activa.tabla.filtros}
        tablero={activa.tabla.tablero}
        indicadores={activa.tabla.indicadores}
        calendario={activa.tabla.calendario}
        agenda={activa.tabla.agenda}
        vistaInicial={activa.tabla.vistaInicial}
        hoy={hoy}
        tablas={[activa.tabla.idTabla]}
        rapidas={puedeEditar ? activa.tabla.rapidas : undefined}
        accionDetalle={puedeEditar ? activa.tabla.accionDetalle : undefined}
        filtrosIniciales={activa.tabla.filtrosIniciales}
        campoTablero={puedeEditar ? (campoPorNombre(activa.tabla.editar, activa.tabla.tablero) ?? undefined) : undefined}
        persona={
          activa.tabla.persona && sesion.nombreAirtable
            ? { campo: activa.tabla.persona, nombre: sesion.nombreAirtable, porDefecto: !sesion.maestro && alcanceHoy(sesion, u.empresa) === "suyo" }
            : undefined
        }
        vistas={vistas}
        edicion={puedeEditar ? { empresa: u.empresa, vertical: u.vertical.segmento, modulo: u.def.segmento, pestana: activa.id } : undefined}
      />
    </>
  );
}

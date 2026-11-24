import Link from "next/link";
import type { Sesion } from "@/lib/acceso/permisos";
import { sensibles } from "@/lib/acceso/permisos";
import { db } from "@/db/cliente";
import { puedeProgramar } from "@/lib/aseos/programacion";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { fechaLarga } from "@/lib/hoy/fechas";
import { crearContador } from "@/lib/medicion/contador";
import { funcionariaDe, funcionarias, rutaDe, sinFuncionaria, turnoAbierto, type Parada, type Turno } from "@/lib/ruta/ruta";
import { clienteServidor } from "@/lib/servidor/airtable";
import { subidasActivas } from "@/lib/servidor/blob";
import { sumarDias } from "@/lib/vistas/periodo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EncabezadoModulo } from "../encabezado";
import { RutaFuncionaria } from "./ruta-funcionaria";

const RUTA = "/verse/host/ruta";
const avance = (ps: Parada[]) => `${ps.filter((p) => p.terminada).length} de ${ps.length}`;

function ListaParadas({ paradas, vacio }: { paradas: Parada[]; vacio: string }) {
  if (!paradas.length) return <p className="text-sm text-muted-foreground">{vacio}</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {paradas.map((p) => (
        <li key={p.recId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
          <span className="w-20 shrink-0 tabular-nums whitespace-nowrap text-muted-foreground">{p.hora || "—"}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{p.unidad}</span>
            {p.comentario && <span className="block truncate text-xs text-muted-foreground">{p.comentario}</span>}
          </span>
          <Badge variant={p.terminada ? "secondary" : "outline"}>{p.estado || "Sin estado"}</Badge>
        </li>
      ))}
    </ul>
  );
}

function SelectorDia({ manana }: { manana: boolean }) {
  return (
    <nav aria-label="Día" className="grid w-full max-w-xs grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
      {[
        ["Hoy", RUTA, !manana],
        ["Mañana", `${RUTA}?dia=manana`, manana],
      ].map(([t, href, activo]) => (
        <Link key={t as string} href={href as string} aria-current={activo ? "page" : undefined} className={cn("rounded-md px-2 py-1.5 text-center", activo ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
          {t as string}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Ruta de aseo. La funcionaria ve sus limpiezas de hoy con su avance, abre y cierra su turno,
 * ve los datos de ingreso solo en turno, reporta cada servicio y ve lo de mañana. Quien
 * coordina ve la ruta de todas, hoy o mañana, y los aseos sin aseadora.
 */
export async function ModuloRuta({ sesion, manana = false }: { sesion: Sesion; manana?: boolean }) {
  const hoy = hoyBogota();
  const dia = manana ? sumarDias(hoy, 1) : hoy;
  const contador = crearContador();
  const airtable = clienteServidor(contador, { fresco: true });
  let error: string | undefined;
  let propia: { nombre: string; paradas: Parada[]; turno: Turno | null; manana: Parada[] } | null = null;
  let equipo: { nombre: string; paradas: Parada[] }[] = [];
  let sinAsignar: Parada[] = [];
  try {
    const f = await funcionariaDe(airtable, sesion);
    if (f) {
      const [paradas, turno, siguientes] = await Promise.all([rutaDe(airtable, f, hoy), turnoAbierto(airtable, f, hoy), rutaDe(airtable, f, sumarDias(hoy, 1))]);
      propia = { nombre: f.nombre, paradas, turno, manana: siguientes };
    } else {
      const activas = (await funcionarias(airtable)).filter((x) => x.activa);
      [equipo, sinAsignar] = await Promise.all([
        Promise.all(activas.map(async (x) => ({ nombre: x.nombre, paradas: await rutaDe(airtable, x, dia) }))),
        sinFuncionaria(airtable, dia),
      ]);
    }
    await contador.volcar(db());
  } catch (e) {
    console.error("[modulo/ruta]", e instanceof Error ? e.message : e);
    error = "Airtable no respondió. Intenta de nuevo en un momento.";
  }

  const fecha = fechaLarga(dia);
  if (error)
    return (
      <>
        <EncabezadoModulo titulo="Ruta de aseo" descripcion={fecha} />
        <p className="px-4 text-sm text-destructive md:px-6">{error}</p>
      </>
    );

  if (propia)
    return (
      <>
        <EncabezadoModulo
          titulo="Ruta de aseo"
          descripcion={`${propia.nombre} · ${fechaLarga(hoy)}${propia.paradas.length ? ` · ${avance(propia.paradas)} terminadas` : ""}`}
        />
        <RutaFuncionaria paradas={propia.paradas} turno={propia.turno} codigos={sensibles(sesion, "verse", "verse-host").codigos} video={subidasActivas()} />
        <section aria-label="Mañana" className="space-y-2 px-4 pb-10 md:px-6">
          <h2 className="text-sm font-medium">
            Mañana <span className="text-muted-foreground">· {propia.manana.length === 1 ? "1 limpieza" : `${propia.manana.length} limpiezas`}</span>
          </h2>
          <ListaParadas paradas={propia.manana} vacio="Sin limpiezas mañana." />
        </section>
      </>
    );

  const total = equipo.reduce((n, g) => n + g.paradas.length, 0) + sinAsignar.length;
  return (
    <>
      <EncabezadoModulo titulo="Ruta de aseo" descripcion={`Rutas de ${manana ? "mañana" : "hoy"} · ${fecha}`} />
      <div className="space-y-6 px-4 pb-10 md:px-6">
        <SelectorDia manana={manana} />
        {total === 0 && <p className="text-sm text-muted-foreground">No hay limpiezas {manana ? "mañana" : "hoy"}.</p>}
        {sinAsignar.length > 0 && (
          <section aria-label="Sin aseadora" className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-medium text-destructive">
              Sin aseadora · {sinAsignar.length}
              {puedeProgramar(sesion) && (
                <Link href="/verse/host/limpiezas?programar=1" className="ml-auto text-xs font-normal text-foreground underline underline-offset-4">
                  Asignar
                </Link>
              )}
            </h2>
            <ListaParadas paradas={sinAsignar} vacio="" />
          </section>
        )}
        {equipo.length === 0 && <p className="text-sm text-muted-foreground">No hay funcionarias activas en FUNCIONARIAS.</p>}
        {equipo.map((g) => (
          <section key={g.nombre} aria-label={`Ruta de ${g.nombre}`} className="space-y-2">
            <h2 className="text-sm font-medium">
              {g.nombre}{" "}
              <span className="text-muted-foreground">
                · {g.paradas.length === 1 ? "1 limpieza" : `${g.paradas.length} limpiezas`}
                {!manana && g.paradas.length > 0 && ` · ${avance(g.paradas)} terminadas`}
              </span>
            </h2>
            <ListaParadas paradas={g.paradas} vacio={`Sin limpiezas ${manana ? "mañana" : "hoy"}.`} />
          </section>
        ))}
      </div>
    </>
  );
}

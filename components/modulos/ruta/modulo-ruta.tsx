import type { Sesion } from "@/lib/acceso/permisos";
import { sensibles } from "@/lib/acceso/permisos";
import { db } from "@/db/cliente";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { fechaLarga } from "@/lib/hoy/fechas";
import { crearContador } from "@/lib/medicion/contador";
import { funcionariaDe, funcionarias, rutaDe, turnoAbierto, type Parada, type Turno } from "@/lib/ruta/ruta";
import { clienteServidor } from "@/lib/servidor/airtable";
import { Badge } from "@/components/ui/badge";
import { EncabezadoModulo } from "../encabezado";
import { RutaFuncionaria } from "./ruta-funcionaria";

/**
 * Ruta de aseo. La funcionaria ve sus limpiezas de hoy, abre y cierra su turno, ve los datos
 * de ingreso solo en turno y reporta cada servicio. Quien coordina ve la ruta de todas.
 */
export async function ModuloRuta({ sesion }: { sesion: Sesion }) {
  const hoy = hoyBogota();
  const contador = crearContador();
  const airtable = clienteServidor(contador);
  let error: string | undefined;
  let propia: { nombre: string; paradas: Parada[]; turno: Turno | null } | null = null;
  let equipo: { nombre: string; paradas: Parada[] }[] = [];
  try {
    const f = await funcionariaDe(airtable, sesion);
    if (f) {
      const [paradas, turno] = await Promise.all([rutaDe(airtable, f, hoy), turnoAbierto(airtable, f, hoy)]);
      propia = { nombre: f.nombre, paradas, turno };
    } else {
      const activas = (await funcionarias(airtable)).filter((x) => x.activa);
      equipo = await Promise.all(activas.map(async (x) => ({ nombre: x.nombre, paradas: await rutaDe(airtable, x, hoy) })));
    }
    await contador.volcar(db());
  } catch (e) {
    console.error("[modulo/ruta]", e instanceof Error ? e.message : e);
    error = "Airtable no respondió. Intenta de nuevo en un momento.";
  }

  const fecha = fechaLarga(hoy);
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
        <EncabezadoModulo titulo="Ruta de aseo" descripcion={`${propia.nombre} · ${fecha}`} />
        <RutaFuncionaria
          paradas={propia.paradas}
          turno={propia.turno}
          codigos={sensibles(sesion, "verse", "verse-host").codigos}
          video={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
        />
      </>
    );

  return (
    <>
      <EncabezadoModulo titulo="Ruta de aseo" descripcion={`Rutas de hoy · ${fecha}`} />
      <div className="space-y-6 px-4 pb-10 md:px-6">
        {equipo.length === 0 && <p className="text-sm text-muted-foreground">No hay funcionarias activas en FUNCIONARIAS.</p>}
        {equipo.map((g) => (
          <section key={g.nombre} aria-label={`Ruta de ${g.nombre}`} className="space-y-2">
            <h2 className="text-sm font-medium">
              {g.nombre} <span className="text-muted-foreground">· {g.paradas.length === 1 ? "1 limpieza" : `${g.paradas.length} limpiezas`}</span>
            </h2>
            {g.paradas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin limpiezas hoy.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {g.paradas.map((p) => (
                  <li key={p.recId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{p.hora || "—"}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.unidad}</span>
                    <Badge variant={p.terminada ? "secondary" : "outline"}>{p.estado || "Sin estado"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

import { Badge } from "@/components/ui/badge";
import { db } from "@/db/cliente";
import type { Sesion } from "@/lib/acceso/permisos";
import { hMin, puedeControlar, semanaHoras, type SemanaFuncionaria } from "@/lib/horas/semana";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";
import { cn } from "@/lib/utils";
import { CerrarTurno, ValidarSemana } from "./acciones";

const n = (x: number) => x.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const dia = (f: string) => `${Number(f.slice(8))}/${Number(f.slice(5, 7))}`;

function Tarjeta({ s, lunes, controla }: { s: SemanaFuncionaria; lunes: string; controla: boolean }) {
  const falta = s.diferencia < 0;
  return (
    <section aria-label={`Horas de ${s.nombre}`} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{s.nombre}</h3>
        {s.validada && <Badge variant="secondary">Validada</Badge>}
        {controla && !s.validada && s.turnos.length > 0 && (
          <span className="ml-auto">
            <ValidarSemana nombre={s.nombre} lunes={lunes} deshabilitado={s.turnos.some((t) => !t.salida)} />
          </span>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Trabajadas</dt>
          <dd className="text-lg font-semibold tabular-nums">{n(s.real)} h</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Meta</dt>
          <dd className="text-lg font-semibold tabular-nums">{n(s.meta)} h</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Diferencia</dt>
          <dd className={cn("text-lg font-semibold tabular-nums", falta && "text-destructive")}>{s.diferencia === 0 ? "Exacta" : `${falta ? "Faltan" : "Sobran"} ${hMin(s.diferencia)}`}</dd>
        </div>
      </dl>
      <ol className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {s.dias.map((d) => (
          <li key={d.fecha} className={cn("rounded-md border px-0.5 py-1", d.festivo && "bg-muted text-muted-foreground", d.programado > 0 && d.real === 0 && "border-destructive/40")}>
            <span className="block text-muted-foreground">{d.nombre.slice(0, 3)}</span>
            <span className="block font-medium tabular-nums">{d.real ? n(d.real) : "—"}</span>
          </li>
        ))}
      </ol>
      {s.abiertos.length > 0 && (
        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">{s.abiertos.length === 1 ? "1 turno sin salida" : `${s.abiertos.length} turnos sin salida`}</p>
          <ul className="space-y-2">
            {s.abiertos.map((t) => (
              <li key={t.recId} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="tabular-nums">
                  {dia(t.fecha)} · entró {t.ingreso || "sin hora"}
                </span>
                {controla && (
                  <span className="ml-auto">
                    <CerrarTurno recId={t.recId} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Control de la semana sobre la tabla de Equipo: horas contra la meta, turnos olvidados y validación. */
export async function ControlSemana({ sesion, lunes }: { sesion: Sesion; lunes: string }) {
  const contador = crearContador();
  const semana = await semanaHoras(clienteServidor(contador), lunes, hoyBogota()).catch((e) => {
    console.error("[horas]", e instanceof Error ? e.message : e);
    return null;
  });
  await contador.volcar(db()).catch(() => undefined);
  if (!semana?.length) return null;
  const controla = puedeControlar(sesion);
  return (
    <div className="grid gap-3 px-4 pb-4 md:px-6 lg:grid-cols-2">
      {semana.map((s) => (
        <Tarjeta key={s.nombre} s={s} lunes={lunes} controla={controla} />
      ))}
    </div>
  );
}

import { alcanceHoy, puede, type Sesion } from "@/lib/acceso/permisos";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import { cronometro, registrarTiempo } from "@/lib/medicion/uso";
import type { Ubicacion } from "@/lib/modulos/registro";
import { leerTabla, type ResultadoTabla } from "@/lib/modulos/tabla";
import { db } from "@/db/cliente";
import { clienteServidor } from "@/lib/servidor/airtable";
import { EncabezadoModulo } from "../encabezado";
import { campoPorNombre } from "@/lib/modulos/editar";
import { periodoInicial } from "@/lib/vistas/periodo";
import { vistasDe } from "@/lib/vistas/guardadas";
import { leerAlertas, ListaAlertas } from "@/components/inicio/alertas";
import { VistaTabla } from "./vista-tabla";
import { ProgramacionAseos } from "@/components/modulos/aseos/programacion";
import { puedeProgramar } from "@/lib/aseos/programacion";
import { NuevoTicket } from "@/components/modulos/tickets/nuevo-ticket";
import { puedeTickets } from "@/lib/tickets/tickets";
import { NuevoContrato } from "@/components/modulos/contratos/nuevo-contrato";
import { puedeContratos } from "@/lib/contratos/generar";
import { ControlSemana } from "@/components/modulos/horas/control-semana";
import { Suspense } from "react";

/** Un módulo de tabla del registro: lee Airtable en el momento, solo lo permitido. */
export async function ModuloTabla({ sesion, u, p, programar }: { sesion: Sesion; u: Ubicacion; p?: string; programar?: boolean }) {
  const transcurrido = cronometro();
  const def = u.def.tabla!;
  const puedeEditar = Boolean(def.editar?.campos.length) && puede(sesion, u.empresa, u.modulo.id, "editar");
  const contador = crearContador();
  const hoy = hoyBogota();
  const periodo = def.periodo ? periodoInicial(def.periodo, p, hoy) : undefined;
  const ruta = `/${u.empresa}/${u.vertical.segmento}/${u.def.segmento}`;
  let r: ResultadoTabla | null = null;
  let error: string | undefined;
  // La tabla, las alertas y las vistas guardadas se leen en paralelo.
  const [tabla, alertas, vistas] = await Promise.all([
    leerTabla(clienteServidor(contador), sesion, u.empresa, u.vertical.id, def, hoy, periodo).then(
      (x) => x,
      (e: unknown) => {
        console.error(`[modulo/${u.def.tipo}]`, e instanceof Error ? e.message : e);
        return null;
      },
    ),
    leerAlertas(sesion, u.def.tipo),
    vistasDe(db(), sesion.usuarioId, ruta).catch(() => []),
  ]);
  if (tabla) {
    r = tabla;
    await contador.volcar(db()).catch(() => undefined);
  } else error = "Airtable no respondió. Intenta de nuevo en un momento.";
  await registrarTiempo(db(), sesion.usuarioId, ruta, hoy, transcurrido());
  return (
    <>
      <EncabezadoModulo titulo={u.modulo.nombre} descripcion={u.def.descripcion}>
        {u.def.tipo === "limpiezas" && u.empresa === "verse" && puedeProgramar(sesion) && <ProgramacionAseos abrirAlInicio={programar} />}
        {u.def.tipo === "tickets" && u.empresa === "verse" && puedeTickets(sesion) && <NuevoTicket />}
        {u.def.tipo === "contratos" && u.empresa === "verse" && puedeContratos(sesion) && <NuevoContrato maestro={sesion.maestro} />}
      </EncabezadoModulo>
      <div className="px-4 md:px-6">
        <ListaAlertas alertas={alertas} compacta />
      </div>
      {u.def.tipo === "equipo" && u.empresa === "verse" && periodo && (
        <Suspense fallback={<div className="mx-4 mb-4 h-40 animate-pulse rounded-lg bg-muted/50 md:mx-6" aria-hidden />}>
          <ControlSemana sesion={sesion} lunes={periodo.inicio} />
        </Suspense>
      )}
      <VistaTabla
        titulo={u.modulo.nombre}
        modulo={u.modulo.nombre}
        columnas={r?.columnas ?? def.columnas}
        detalle={r?.detalle ?? []}
        filas={r?.filas ?? []}
        ocultos={r?.ocultos ?? []}
        vacio={def.vacio}
        error={error}
        periodo={periodo}
        filtros={def.filtros}
        tablero={def.tablero}
        indicadores={def.indicadores}
        calendario={def.calendario}
        agenda={def.agenda}
        vistaInicial={def.vistaInicial}
        hoy={hoy}
        tablas={[def.idTabla]}
        relacionados={def.relacionados?.length ? { empresa: u.empresa, vertical: u.vertical.segmento, modulo: u.def.segmento } : undefined}
        rapidas={puedeEditar ? def.rapidas : undefined}
        accionDetalle={puedeEditar ? def.accionDetalle : undefined}
        campoTablero={puedeEditar ? (campoPorNombre(def.editar, def.tablero) ?? undefined) : undefined}
        persona={
          def.persona && sesion.nombreAirtable
            ? { campo: def.persona, nombre: sesion.nombreAirtable, porDefecto: !sesion.maestro && alcanceHoy(sesion, u.empresa) === "suyo" }
            : undefined
        }
        vistas={vistas}
        edicion={puedeEditar ? { empresa: u.empresa, vertical: u.vertical.segmento, modulo: u.def.segmento } : undefined}
      />
    </>
  );
}

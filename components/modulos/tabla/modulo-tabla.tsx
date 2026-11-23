import { puede, type Sesion } from "@/lib/acceso/permisos";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import type { Ubicacion } from "@/lib/modulos/registro";
import { leerTabla, type ResultadoTabla } from "@/lib/modulos/tabla";
import { db } from "@/db/cliente";
import { clienteServidor } from "@/lib/servidor/airtable";
import { EncabezadoModulo } from "../encabezado";
import { leerPeriodo } from "@/lib/vistas/periodo";
import { vistasDe } from "@/lib/vistas/guardadas";
import { VistaTabla } from "./vista-tabla";

/** Un módulo de tabla del registro: lee Airtable en el momento, solo lo permitido. */
export async function ModuloTabla({ sesion, u, p }: { sesion: Sesion; u: Ubicacion; p?: string }) {
  const def = u.def.tabla!;
  const puedeEditar = Boolean(def.editar?.campos.length) && puede(sesion, u.empresa, u.modulo.id, "editar");
  const contador = crearContador();
  const hoy = hoyBogota();
  const periodo = def.periodo ? leerPeriodo(def.periodo.unidad, p, hoy) : undefined;
  const ruta = `/${u.empresa}/${u.vertical.segmento}/${u.def.segmento}`;
  let r: ResultadoTabla | null = null;
  let error: string | undefined;
  try {
    r = await leerTabla(clienteServidor(contador), sesion, u.empresa, u.vertical.id, def, hoy, periodo);
    await contador.volcar(db());
  } catch (e) {
    console.error(`[modulo/${u.def.tipo}]`, e instanceof Error ? e.message : e);
    error = "Airtable no respondió. Intenta de nuevo en un momento.";
  }
  return (
    <>
      <EncabezadoModulo titulo={u.modulo.nombre} descripcion={u.def.descripcion} />
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
        vistas={await vistasDe(db(), sesion.usuarioId, ruta).catch(() => [])}
        edicion={puedeEditar ? { empresa: u.empresa, vertical: u.vertical.segmento, modulo: u.def.segmento } : undefined}
      />
    </>
  );
}

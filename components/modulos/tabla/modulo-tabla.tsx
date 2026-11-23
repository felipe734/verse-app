import { puede, type Sesion } from "@/lib/acceso/permisos";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { crearContador } from "@/lib/medicion/contador";
import type { Ubicacion } from "@/lib/modulos/registro";
import { leerTabla, type ResultadoTabla } from "@/lib/modulos/tabla";
import { db } from "@/db/cliente";
import { clienteServidor } from "@/lib/servidor/airtable";
import { EncabezadoModulo } from "../encabezado";
import { VistaTabla } from "./vista-tabla";

/** Un módulo de tabla del registro: lee Airtable en el momento, solo lo permitido. */
export async function ModuloTabla({ sesion, u }: { sesion: Sesion; u: Ubicacion }) {
  const def = u.def.tabla!;
  const puedeEditar = Boolean(def.editar?.campos.length) && puede(sesion, u.empresa, u.modulo.id, "editar");
  const contador = crearContador();
  let r: ResultadoTabla | null = null;
  let error: string | undefined;
  try {
    r = await leerTabla(clienteServidor(contador), sesion, u.empresa, u.vertical.id, def, hoyBogota());
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
        edicion={puedeEditar ? { empresa: u.empresa, vertical: u.vertical.segmento, modulo: u.def.segmento } : undefined}
      />
    </>
  );
}

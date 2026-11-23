import { accionPendiente } from "@/app/(privado)/(fijas)/hoy/acciones";
import { db } from "@/db/cliente";
import { empresasVisibles, type Sesion } from "@/lib/acceso/permisos";
import { aprobacionesDe } from "@/lib/hoy/aprobar";
import { aVista } from "@/lib/hoy/vista";
import { TODAS } from "@/lib/modulos/registro";
import { EncabezadoModulo } from "../encabezado";
import { ListaAprobar } from "./lista-aprobar";

export async function ModuloAprobar({ sesion, empresa }: { sesion: Sesion; empresa: string }) {
  const lista = await aprobacionesDe(db(), sesion, empresa === TODAS ? empresasVisibles(sesion) : [empresa]);
  const vista = lista.map((a) => ({ ...aVista(a), cambio: a.cambio, puedeResponder: a.puedeResponder }));
  const abiertas = vista.filter((_, i) => !lista[i]!.aprobadaEnApp);
  const enCurso = vista.filter((_, i) => lista[i]!.aprobadaEnApp);
  return (
    <>
      <EncabezadoModulo titulo="Para aprobar" descripcion="Cambios que Verse OS propone. Con tu sí, los aplica en su próxima corrida." />
      <ListaAprobar abiertas={abiertas} enCurso={enCurso} conEmpresa={empresa === TODAS} ejecutar={accionPendiente} />
    </>
  );
}

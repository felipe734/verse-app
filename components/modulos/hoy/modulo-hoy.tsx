import Link from "next/link";
import { accionPendiente } from "@/app/(privado)/(fijas)/hoy/acciones";
import { db } from "@/db/cliente";
import type { Sesion } from "@/lib/acceso/permisos";
import { sesionPorId } from "@/lib/acceso/sesion";
import { auditar } from "@/lib/auditoria";
import { hoyDe } from "@/lib/hoy/datos";
import { fechaLarga } from "@/lib/hoy/fechas";
import { aVista } from "@/lib/hoy/vista";
import { empresasVisibles } from "@/lib/acceso/permisos";
import { TODAS } from "@/lib/modulos/registro";
import { EncabezadoModulo } from "../encabezado";
import { ListaHoy } from "./lista-hoy";

/** Hoy de una empresa o de Todas. "Ver como" (solo Maestro) queda en AUDITORIA y es de solo lectura. */
export async function ModuloHoy({ sesion, empresa, verComo }: { sesion: Sesion; empresa: string; verComo?: string }) {
  const otra = sesion.maestro && verComo && verComo !== sesion.usuarioId ? await sesionPorId(db(), verComo) : null;
  if (otra) await auditar(db(), { autor: sesion.correo, accion: "acceso.ver_como", detalle: otra.correo });
  const quien = otra ?? sesion;
  const empresas = empresa === TODAS ? empresasVisibles(quien) : [empresa];
  const hoy = await hoyDe(db(), quien, empresas);
  const secciones = hoy.secciones.map((s) => ({ id: s.id, titulo: s.titulo, filas: s.items.map((t) => aVista({ ...t, puedeEditar: t.puedeEditar && !otra })) }));

  return (
    <>
      {otra && (
        <p role="status" className="flex flex-wrap items-center gap-2 border-b bg-muted px-4 py-2 text-sm md:px-6">
          Viendo como <b>{otra.correo}</b>
          {otra.estado !== "activo" ? ` (${otra.estado})` : ""}. Solo lectura.
          <Link href="?" className="underline">
            Volver a mi vista
          </Link>
        </p>
      )}
      <EncabezadoModulo titulo="Hoy" descripcion={`${fechaLarga(hoy.hoy).replace(/^./, (c) => c.toUpperCase())} · ${hoy.total} ${hoy.total === 1 ? "pendiente" : "pendientes"}`} />
      <ListaHoy secciones={secciones} hoy={hoy.hoy} conEmpresa={empresa === TODAS} ejecutar={accionPendiente} soloLectura={Boolean(otra)} />
    </>
  );
}

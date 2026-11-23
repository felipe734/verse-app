import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ModuloAprobar } from "@/components/modulos/aprobar/modulo-aprobar";
import { ModuloCorreo } from "@/components/modulos/correo/modulo-correo";
import { ModuloSistema } from "@/components/modulos/sistema/modulo-sistema";
import { ModuloPanel } from "@/components/modulos/tabla/modulo-panel";
import { ModuloTabla } from "@/components/modulos/tabla/modulo-tabla";
import { EsqueletoModulo } from "@/components/modulos/encabezado";
import { ModuloHoy } from "@/components/modulos/hoy/modulo-hoy";
import { ModuloRuta } from "@/components/modulos/ruta/modulo-ruta";
import { sesionActual } from "@/lib/acceso/actual";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { PLATFORM_NAME } from "@/lib/config";
import { REGISTRO, ubicar } from "@/lib/modulos/registro";

const defPorSegmento = (segmento: string) => REGISTRO.find((d) => d.segmento === segmento);

type Params = { empresa: string; vertical: string; modulo: string };
type Busqueda = { verComo?: string; cuenta?: string; pestana?: string; p?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { modulo } = await params;
  const nombre = defPorSegmento(modulo)?.nombre ?? "Módulo";
  return { title: `${nombre} · ${PLATFORM_NAME}` };
}

async function Contenido({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Busqueda> }) {
  const sesion = await sesionActual();
  const { empresa, vertical, modulo } = await params;
  const busqueda = await searchParams;
  const u = ubicar(sesion, sesion.estructura ?? ESTRUCTURA, empresa, vertical, modulo);
  if (!u) notFound();
  if (u.def.tabla) return <ModuloTabla sesion={sesion} u={u} p={busqueda.p} />;
  if (u.def.pestanas) return <ModuloPanel sesion={sesion} u={u} pestana={busqueda.pestana} p={busqueda.p} />;
  switch (u.def.tipo) {
    case "hoy":
      return <ModuloHoy sesion={sesion} empresa={empresa} verComo={busqueda.verComo} />;
    case "aprobar":
      return <ModuloAprobar sesion={sesion} empresa={empresa} />;
    case "correo":
      return <ModuloCorreo sesion={sesion} empresa={empresa} cuenta={busqueda.cuenta} />;
    case "ruta":
      return <ModuloRuta sesion={sesion} />;
    case "sistema":
      return <ModuloSistema sesion={sesion} empresa={empresa} />;
    default:
      notFound();
  }
}

/** Un módulo del registro. Lo que no existe, no está construido o no se puede ver da 404. */
export default function PaginaModulo({ params, searchParams }: PageProps<"/[empresa]/[vertical]/[modulo]">) {
  return (
    <Suspense fallback={<EsqueletoModulo />}>
      <Contenido params={params as Promise<Params>} searchParams={searchParams as Promise<Busqueda>} />
    </Suspense>
  );
}

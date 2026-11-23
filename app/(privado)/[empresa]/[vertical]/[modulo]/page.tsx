import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ModuloAprobar } from "@/components/modulos/aprobar/modulo-aprobar";
import { ModuloCorreo } from "@/components/modulos/correo/modulo-correo";
import { ModuloSistema } from "@/components/modulos/sistema/modulo-sistema";
import { EsqueletoModulo } from "@/components/modulos/encabezado";
import { ModuloHoy } from "@/components/modulos/hoy/modulo-hoy";
import { sesionActual } from "@/lib/acceso/actual";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { PLATFORM_NAME } from "@/lib/config";
import { ubicar } from "@/lib/modulos/registro";

type Params = { empresa: string; vertical: string; modulo: string };
type Busqueda = { verComo?: string; cuenta?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { modulo } = await params;
  const nombre = { hoy: "Hoy", aprobar: "Para aprobar", correo: "Correo", sistema: "Sistema" }[modulo] ?? "Módulo";
  return { title: `${nombre} · ${PLATFORM_NAME}` };
}

async function Contenido({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Busqueda> }) {
  const sesion = await sesionActual();
  const { empresa, vertical, modulo } = await params;
  const busqueda = await searchParams;
  const u = ubicar(sesion, sesion.estructura ?? ESTRUCTURA, empresa, vertical, modulo);
  if (!u) notFound();
  switch (u.def.tipo) {
    case "hoy":
      return <ModuloHoy sesion={sesion} empresa={empresa} verComo={busqueda.verComo} />;
    case "aprobar":
      return <ModuloAprobar sesion={sesion} empresa={empresa} />;
    case "correo":
      return <ModuloCorreo sesion={sesion} empresa={empresa} cuenta={busqueda.cuenta} />;
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

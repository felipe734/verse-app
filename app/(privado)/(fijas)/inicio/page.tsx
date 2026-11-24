import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AlertasInicio } from "@/components/inicio/alertas";
import { PulsoInicio } from "@/components/inicio/pulso";
import { ResumenDia } from "@/components/inicio/resumen";
import { EsqueletoTarjeta, TarjetaModulo } from "@/components/inicio/tarjeta-modulo";
import { EncabezadoModulo, EsqueletoModulo } from "@/components/modulos/encabezado";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { empresasVisibles } from "@/lib/acceso/permisos";
import { PLATFORM_NAME } from "@/lib/config";
import { aprobacionesDe } from "@/lib/hoy/aprobar";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { hoyDe } from "@/lib/hoy/datos";
import { fechaLarga } from "@/lib/hoy/fechas";
import { inicioDe, navegacion, REGISTRO } from "@/lib/modulos/registro";
import { registrarUso } from "@/lib/medicion/uso";

export const metadata: Metadata = { title: `Inicio · ${PLATFORM_NAME}` };

const saludo = () => {
  const h = new Date(Date.now() - 5 * 3_600_000).getUTCHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

async function Contenido() {
  const sesion = await sesionActual();
  await registrarUso(db(), sesion.usuarioId, "/inicio", hoyBogota());
  const estructura = sesion.estructura ?? ESTRUCTURA;
  const visibles = empresasVisibles(sesion);
  const porEmpresa = visibles.map((id) => ({ id, nombre: estructura.find((e) => e.id === id)?.nombre ?? id, grupos: navegacion(sesion, estructura, id) }));
  const modulos = porEmpresa.flatMap((e) => e.grupos.flatMap((g) => g.items));
  const tieneHoy = modulos.some((i) => i.tipo === "hoy");
  // Quien tiene una sola pantalla (aseo, por ejemplo) entra directo a ella.
  if (!tieneHoy && modulos.length <= 1) redirect(inicioDe(sesion, estructura, visibles) ?? "/sin-acceso");

  const [hoy, aprobaciones] = tieneHoy ? await Promise.all([hoyDe(db(), sesion, visibles), aprobacionesDe(db(), sesion, visibles)]) : [null, []];
  const cuenta = (id: string) => hoy?.secciones.find((s) => s.id === id)?.items.length ?? 0;
  const porAprobar = aprobaciones.filter((a) => !a.aprobadaEnApp && a.puedeResponder).length;
  const nombre = (sesion.nombreAirtable ?? sesion.correo.split("@")[0] ?? "").split(" ")[0];
  const lineas = (id: string, titulo: string) => {
    const items = hoy?.secciones.find((x) => x.id === id)?.items ?? [];
    return items.length ? `${titulo}: ${items.slice(0, 6).map((t) => t.asunto ?? "").filter(Boolean).join("; ")}` : null;
  };
  const baseResumen = [lineas("critico", "Críticos"), lineas("vencido", "Vencidos"), lineas("hoy", "Para hoy"), porAprobar ? `Para aprobar: ${porAprobar}` : null].filter(Boolean).join("\n");

  return (
    <>
      <EncabezadoModulo titulo={`${saludo()}, ${nombre}`} descripcion={fechaLarga(hoyBogota()) ?? undefined} />
      <div className="space-y-8 px-4 pb-12 md:px-6">
        {tieneHoy && (
          <section aria-label="Para hoy" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Críticos", cuenta("critico"), "/hoy", cuenta("critico") > 0],
              ["Vencidos", cuenta("vencido"), "/hoy", cuenta("vencido") > 0],
              ["Para hoy", cuenta("hoy"), "/hoy", false],
              ["Para aprobar", porAprobar, "/aprobar", porAprobar > 0],
            ].map(([t, n, href, alerta]) => (
              <Link key={t as string} href={href as string} className="rounded-lg border bg-card px-4 py-3 hover:border-foreground/20">
                <p className="text-xs text-muted-foreground">{t as string}</p>
                <p className={`text-2xl font-semibold tabular-nums ${alerta ? "text-destructive" : ""}`}>{n as number}</p>
              </Link>
            ))}
          </section>
        )}
        <Suspense fallback={<div className="h-28 animate-pulse rounded-lg bg-muted/50" aria-hidden />}>
          <PulsoInicio sesion={sesion} />
        </Suspense>
        <Suspense fallback={null}>
          <ResumenDia sesion={sesion} nombre={nombre ?? ""} base={baseResumen} />
        </Suspense>
        <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted/50" aria-hidden />}>
          <AlertasInicio sesion={sesion} />
        </Suspense>
        {porEmpresa.map((e) => {
          const grupos = e.grupos
            .map((g) => ({
              ...g,
              items: g.items
                .map((i) => {
                  const def = REGISTRO.find((d) => d.tipo === i.tipo);
                  const tabla = def?.tabla ?? def?.pestanas?.[0]?.tabla;
                  return tabla?.indicadores?.length ? { ...i, tabla } : null;
                })
                .filter((x): x is NonNullable<typeof x> => Boolean(x)),
            }))
            .filter((g) => g.items.length);
          if (!grupos.length) return null;
          return (
            <section key={e.id} aria-label={e.nombre} className="space-y-4">
              {visibles.length > 1 && <h2 className="text-sm font-semibold">{e.nombre}</h2>}
              {grupos.map((g) => (
                <div key={g.vertical} className="space-y-2">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.nombre}</h3>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {g.items.map((i) => (
                      <Suspense key={i.id} fallback={<EsqueletoTarjeta />}>
                        <TarjetaModulo sesion={sesion} empresa={e.id} vertical={g.vertical} nombre={i.nombre} icono={i.icono} href={i.href} def={i.tabla} />
                      </Suspense>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Inicio por rol: lo de hoy y una tarjeta por módulo con sus cifras del período actual. */
export default function Inicio() {
  return (
    <Suspense fallback={<EsqueletoModulo />}>
      <Contenido />
    </Suspense>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/auth";
import { Encabezado, Tarjeta } from "@/components/ajustes/encabezado";
import { Item } from "@/components/hoy/item";
import { Button } from "@/components/ui/button";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { sesionPorId } from "@/lib/acceso/sesion";
import { TODAS, vistaHoy } from "@/lib/acceso/vista";
import { auditar } from "@/lib/auditoria";
import { hoyDe } from "@/lib/hoy/datos";

export const metadata: Metadata = { title: "Hoy · Verse App" };

async function salir() {
  "use server";
  await signOut({ redirectTo: "/entrar" });
}

type Parametros = { empresa?: string; verComo?: string };

async function Panel({ searchParams }: { searchParams: Promise<Parametros> }) {
  const sesion = await sesionActual();
  const { empresa: pedida, verComo } = await searchParams;

  // "Ver como": solo el Maestro, y queda en AUDITORIA.
  const otra = sesion.maestro && verComo && verComo !== sesion.usuarioId ? await sesionPorId(db(), verComo) : null;
  if (otra) await auditar(db(), { autor: sesion.correo, accion: "acceso.ver_como", detalle: otra.correo });
  const quien = otra ?? sesion;
  const vista = vistaHoy(quien, pedida);
  const extra = otra ? `&verComo=${otra.usuarioId}` : "";
  const deEmpresas = vista.empresa === TODAS ? vista.empresas.map((e) => e.id) : vista.empresa ? [vista.empresa] : [];
  const hoy = await hoyDe(db(), quien, deEmpresas);
  const conEmpresa = vista.empresa === TODAS;

  return (
    <>
      {otra && (
        <p role="status" className="rounded-xl bg-[var(--verse-azul-claro)] px-4 py-3 text-[var(--verse-azul)]">
          Viendo como {otra.correo}
          {otra.estado !== "activo" ? ` (${otra.estado}: hoy no puede entrar)` : ""}.{" "}
          <Link href="/hoy" className="underline">
            Volver a mi vista
          </Link>
        </p>
      )}

      <nav aria-label="Empresa" className="flex flex-wrap gap-2">
        {[...vista.empresas, ...(vista.todas ? [{ id: TODAS, nombre: "Todas" }] : [])].map((e) => {
          const activa = e.id === vista.empresa;
          return (
            <Link
              key={e.id}
              href={`/hoy?empresa=${e.id}${extra}`}
              aria-current={activa ? "page" : undefined}
              className={`rounded-full px-3 py-1 font-display text-sm ${activa ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              {e.nombre}
            </Link>
          );
        })}
      </nav>

      {hoy.secciones.map((sec) =>
        sec.items.length === 0 ? null : (
          <section key={sec.id} aria-label={sec.titulo}>
            <h2 className="flex justify-between font-display text-[11px] tracking-[1.6px] text-muted-foreground">
              <span>{sec.titulo.toUpperCase()}</span>
              <span>{sec.items.length}</span>
            </h2>
            <div className="mt-1 divide-y divide-[var(--verse-filete-suave)]">
              {sec.items.map((t) => (
                <Item key={t.recId} t={t} conEmpresa={conEmpresa} />
              ))}
            </div>
          </section>
        ),
      )}
      {vista.grupos.length > 0 && hoy.total === 0 && <p>Nada pendiente para hoy.</p>}

      {vista.grupos.length === 0 ? (
        <p>Todavía no hay módulos asignados. Pídele acceso a Felipe.</p>
      ) : (
        <details className="text-[13.5px]">
          <summary className="cursor-pointer font-display text-[11px] tracking-[1.6px] text-muted-foreground">TUS MÓDULOS</summary>
          <div className="mt-2 space-y-3">
            {vista.grupos.map((g) => (
              <div key={`${g.empresa}-${g.vertical}`}>
                <b className="text-foreground">{vista.empresa === TODAS ? `${g.empresa} · ${g.vertical}` : g.vertical}</b>
                <div className="text-muted-foreground">{g.modulos.map((m) => m.nombre).join(" · ")}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-4 text-[12.5px] text-muted-foreground">
        <span>
          {sesion.correo}
          {sesion.maestro ? " · Maestro" : ""}
        </span>
        <span className="flex items-center gap-3">
          {sesion.maestro && (
            <Link href="/ajustes" className="text-[var(--verse-azul)] underline">
              Ajustes
            </Link>
          )}
          <form action={salir}>
            <Button type="submit" variant="outline" size="sm">
              Salir
            </Button>
          </form>
        </span>
      </div>
    </>
  );
}

export default function Hoy({ searchParams }: PageProps<"/hoy">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <Encabezado submarca="HOY" />
      <Tarjeta>
        <Suspense fallback={<p className="text-muted-foreground">Cargando tu acceso</p>}>
          <Panel searchParams={searchParams as Promise<Parametros>} />
        </Suspense>
      </Tarjeta>
    </main>
  );
}

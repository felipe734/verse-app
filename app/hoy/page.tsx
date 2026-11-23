import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { sesionActual } from "@/lib/acceso/actual";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { empresasVisibles, modulosVisibles } from "@/lib/acceso/permisos";

export const metadata: Metadata = { title: "Hoy · Verse App" };

async function salir() {
  "use server";
  await signOut({ redirectTo: "/entrar" });
}

async function Panel({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const sesion = await sesionActual();
  const { empresa: pedida } = await searchParams;
  const visibles = empresasVisibles(sesion);
  const empresa = visibles.includes(pedida ?? "") ? pedida! : visibles[0];
  const datos = ESTRUCTURA.find((e) => e.id === empresa);
  const mios = new Set(empresa ? modulosVisibles(sesion, empresa) : []);

  return (
    <>
      <nav aria-label="Empresa" className="flex gap-2">
        {visibles.map((id) => {
          const e = ESTRUCTURA.find((x) => x.id === id)!;
          const activa = id === empresa;
          return (
            <Link
              key={id}
              href={`/hoy?empresa=${id}`}
              aria-current={activa ? "page" : undefined}
              className={`rounded-full px-3 py-1 font-display text-sm ${activa ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              {e.nombre}
            </Link>
          );
        })}
      </nav>

      {!datos ? (
        <p>Todavía no tienes módulos asignados. Pídele acceso a Felipe.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Hoy, Para aprobar y Sistema llegan en la entrega 3. Estos son los módulos que tu acceso abre en {datos.nombre}.
          </p>
          {datos.verticales.map((v) => {
            const lista = v.modulos.filter((m) => mios.has(m.id));
            if (!lista.length) return null;
            return (
              <section key={v.id}>
                <h2 className="font-display text-[11px] tracking-[1.6px] text-muted-foreground">{v.nombre.toUpperCase()}</h2>
                <ul className="mt-1 divide-y divide-[var(--verse-filete-suave)]">
                  {lista.map((m) => (
                    <li key={m.id} className="py-2.5">
                      <b className="text-foreground">{m.nombre}</b>
                      <div className="text-[12.5px] text-muted-foreground">{m.descripcion}</div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-4 text-[12.5px] text-muted-foreground">
        <span>
          {sesion.correo}
          {sesion.maestro ? " · Maestro" : ""}
        </span>
        <form action={salir}>
          <Button type="submit" variant="outline" size="sm">
            Salir
          </Button>
        </form>
      </div>
    </>
  );
}

export default function Hoy({ searchParams }: PageProps<"/hoy">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <header className="flex items-center justify-between rounded-t-2xl bg-primary px-6 py-4">
        <span className="font-display text-sm font-bold tracking-[4px] text-primary-foreground">
          VERSE<span className="ml-2.5 text-xs tracking-[2px] text-[#a9b8cc]">HOY</span>
        </span>
        <span aria-hidden className="size-[9px] rounded-full bg-[var(--verse-naranja)]" />
      </header>
      <article className="space-y-5 rounded-b-2xl border border-t-0 bg-card px-6 py-6 text-[14.5px] leading-relaxed text-[var(--verse-parrafo)]">
        <Suspense fallback={<p className="text-muted-foreground">Cargando tu acceso</p>}>
          <Panel searchParams={searchParams as Promise<{ empresa?: string }>} />
        </Suspense>
      </article>
    </main>
  );
}

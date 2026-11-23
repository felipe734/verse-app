import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Encabezado, Tarjeta } from "@/components/ajustes/encabezado";
import { sesionActual } from "@/lib/acceso/actual";
import { bandejaDe, cuentasLegibles } from "@/lib/correo/bandeja";
import { cuentaPorId } from "@/lib/correo/cuentas";
import { composioServidor } from "@/lib/servidor/composio";

export const metadata: Metadata = { title: "Correo · Verse App" };

const NOMBRE_OS: Record<string, string> = { verse: "Verse", cyc: "C&C" };

const hora = (iso: string) =>
  iso ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "";

const remitente = (de: string) => de.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || de;

async function Bandeja({ searchParams }: { searchParams: Promise<{ cuenta?: string }> }) {
  const sesion = await sesionActual();
  const { cuenta } = await searchParams;
  const legibles = cuentasLegibles(sesion);
  if (legibles.length === 0) return <p>Tu acceso no incluye correo. Pídeselo a Felipe.</p>;
  const cliente = composioServidor();
  if (!cliente) return <p>El correo no está configurado todavía (falta COMPOSIO_API_KEY en Vercel).</p>;
  const b = await bandejaDe(cliente, sesion, { cuenta });

  return (
    <>
      <nav aria-label="Cuenta" className="flex flex-wrap gap-2">
        {[{ id: "", correo: "Todas" }, ...legibles].map((c) => {
          const activa = (cuenta ?? "") === c.id;
          return (
            <Link
              key={c.id || "todas"}
              href={c.id ? `/correo?cuenta=${c.id}` : "/correo"}
              aria-current={activa ? "page" : undefined}
              className={`rounded-full px-3 py-1 font-display text-sm ${activa ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              {c.correo.split("@")[0]}
              {c.id ? `@ ${cuentaPorId(c.id)?.empresa === "cyc" ? "C&C" : "Verse"}` : ""}
            </Link>
          );
        })}
      </nav>

      {b.avisos.map((a) => (
        <p key={a} role="status" className="rounded-xl bg-[var(--verse-azul-claro)] px-4 py-3 text-[var(--verse-azul)]">
          {a}
        </p>
      ))}

      {b.colas.map((cola) => {
        const [os, nombre] = cola.id.split("·");
        return (
          <section key={cola.id} aria-label={cola.id}>
            <h2 className="flex justify-between font-display text-[11px] tracking-[1.6px] text-muted-foreground">
              <span>
                {NOMBRE_OS[os!]?.toUpperCase()} · {nombre!.toUpperCase()}
              </span>
              <span>{cola.items.length}</span>
            </h2>
            <ul className="mt-1 divide-y divide-[var(--verse-filete-suave)]">
              {cola.items.map((c) => (
                <li key={`${c.cuenta}-${c.id}`}>
                  <Link href={`/correo/${c.cuenta}/${c.hilo}`} className="block py-2.5">
                    <span className="flex justify-between gap-3 text-[12.5px] text-muted-foreground">
                      <span className="truncate">
                        {c.noLeido && <span aria-label="Sin leer" className="mr-1.5 inline-block size-[7px] rounded-full bg-[var(--verse-naranja)]" />}
                        {remitente(c.de)}
                      </span>
                      <span className="shrink-0">{hora(c.fecha)}</span>
                    </span>
                    <span className="block font-display text-foreground">{c.asunto}</span>
                    <span className="line-clamp-2 block text-[13px]">{c.vista}</span>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {cuentaPorId(c.cuenta)?.correo}
                      {c.tambienEn.length ? ` · también en ${c.tambienEn.map((x) => cuentaPorId(x)?.correo).join(", ")}` : ""}
                      {c.adjuntos ? ` · ${c.adjuntos} adjunto${c.adjuntos > 1 ? "s" : ""}` : ""}
                      {c.ruta.responde ? "" : " · no se responde"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {b.colas.length === 0 && <p>Nada nuevo en las últimas {b.horas} horas.</p>}
      {b.ruido > 0 && (
        <p className="text-[12.5px] text-muted-foreground">
          {b.ruido} correo{b.ruido > 1 ? "s" : ""} de promociones, boletines o firmas de AFFI no se listan.
        </p>
      )}
    </>
  );
}

export default function Correo({ searchParams }: PageProps<"/correo">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <Encabezado submarca="CORREO" />
      <Tarjeta>
        <Suspense fallback={<p className="text-muted-foreground">Leyendo las bandejas</p>}>
          <Bandeja searchParams={searchParams as Promise<{ cuenta?: string }>} />
        </Suspense>
      </Tarjeta>
    </main>
  );
}

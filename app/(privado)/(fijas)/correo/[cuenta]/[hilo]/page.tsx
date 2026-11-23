import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Encabezado, Tarjeta } from "@/components/ajustes/encabezado";
import { sesionActual } from "@/lib/acceso/actual";
import { hiloDe } from "@/lib/correo/bandeja";
import { cuentaPorId } from "@/lib/correo/cuentas";
import { composioServidor } from "@/lib/servidor/composio";

export const metadata: Metadata = { title: "Correo · Verse App" };

const fecha = (iso: string) =>
  iso ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "";

async function Hilo({ params }: { params: Promise<{ cuenta: string; hilo: string }> }) {
  const sesion = await sesionActual();
  const { cuenta, hilo } = await params;
  const cliente = composioServidor();
  if (!cliente) return <p>El correo no está configurado todavía.</p>;
  const r = await hiloDe(cliente, sesion, cuenta, hilo);
  if ("error" in r) return <p>{r.error}</p>;

  return (
    <>
      <Link href="/correo" className="text-[13px] underline underline-offset-2 hover:text-foreground">
        Volver a la bandeja
      </Link>
      <h1 className="text-lg text-foreground">{r.mensajes.at(-1)?.asunto || "(sin asunto)"}</h1>
      <p className="text-[12.5px] text-muted-foreground">En {cuentaPorId(cuenta)?.correo}</p>
      {r.mensajes.map((m) => (
        <article key={m.id} className="space-y-2 border-t pt-4">
          <header className="text-[12.5px] text-muted-foreground">
            <b className="text-foreground">{m.de}</b>
            <br />
            Para {m.para} · {fecha(m.fecha)}
          </header>
          {/* Texto plano: el HTML del remitente nunca se pinta en la app. */}
          <div className="whitespace-pre-wrap break-words text-[14px]">{m.texto}</div>
          {m.adjuntos.length > 0 && <p className="text-[12.5px] text-muted-foreground">Adjuntos: {m.adjuntos.join(", ")}</p>}
        </article>
      ))}
      <a
        href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(cuentaPorId(cuenta)?.correo ?? "")}#all/${hilo}`}
        target="_blank"
        rel="noreferrer"
        className="text-[13px] underline underline-offset-2 hover:text-foreground"
      >
        Abrir en Gmail
      </a>
    </>
  );
}

export default function PaginaHilo({ params }: PageProps<"/correo/[cuenta]/[hilo]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <Encabezado submarca="CORREO" />
      <Tarjeta>
        <Suspense fallback={<p className="text-muted-foreground">Abriendo el hilo</p>}>
          <Hilo params={params} />
        </Suspense>
      </Tarjeta>
    </main>
  );
}

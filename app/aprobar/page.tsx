import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Encabezado, Seccion, Tarjeta } from "@/components/ajustes/encabezado";
import { Responder } from "@/components/hoy/responder";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { empresasVisibles } from "@/lib/acceso/permisos";
import { aprobacionesDe } from "@/lib/hoy/aprobar";
import { accionPendiente } from "../hoy/acciones";

export const metadata: Metadata = { title: "Para aprobar · Verse App" };

async function Lista() {
  const sesion = await sesionActual();
  const lista = await aprobacionesDe(db(), sesion, empresasVisibles(sesion));
  const abiertas = lista.filter((a) => !a.aprobadaEnApp);
  const enCurso = lista.filter((a) => a.aprobadaEnApp);

  return (
    <>
      <p>
        <Link href="/hoy" className="text-[var(--verse-azul)] underline">
          Hoy
        </Link>{" "}
        · Para aprobar
      </p>
      <Seccion titulo={`Por responder · ${abiertas.length}`}>
        {abiertas.length === 0 && <p>No hay cambios esperando tu respuesta.</p>}
        <ul className="divide-y divide-[var(--verse-filete-suave)]">
          {abiertas.map((a) => (
            <li key={a.recId} className="space-y-2 py-3">
              <div>
                <b className="text-foreground">{a.asunto}</b>
                <div className="text-[12.5px] text-muted-foreground">{[a.empresa, a.proceso, `fila ${a.numero ?? ""}`].join(" · ")}</div>
              </div>
              <p className="whitespace-pre-line rounded-xl bg-[var(--verse-lienzo)] px-4 py-3 text-[13.5px]">{a.cambio}</p>
              {a.puedeResponder ? (
                <Responder ejecutar={accionPendiente.bind(null, a.recId)} />
              ) : (
                <p className="text-[12.5px] text-muted-foreground">Solo quien tiene la casilla Aprobar puede responder.</p>
              )}
            </li>
          ))}
        </ul>
      </Seccion>
      {enCurso.length > 0 && (
        <Seccion titulo={`Aprobadas, esperando a Verse OS · ${enCurso.length}`}>
          <ul className="divide-y divide-[var(--verse-filete-suave)] text-[13.5px]">
            {enCurso.map((a) => (
              <li key={a.recId} className="py-2.5">
                <b className="text-foreground">{a.asunto}</b> · {a.cambio}
              </li>
            ))}
          </ul>
        </Seccion>
      )}
    </>
  );
}

export default function Aprobar() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <Encabezado submarca="APROBAR" />
      <Tarjeta>
        <Suspense fallback={<p className="text-muted-foreground">Cargando</p>}>
          <Lista />
        </Suspense>
      </Tarjeta>
    </main>
  );
}

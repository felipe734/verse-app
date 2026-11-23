import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Encabezado, Seccion, Tarjeta } from "@/components/ajustes/encabezado";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { empresasVisibles, puede } from "@/lib/acceso/permisos";
import { SISTEMA_POR_EMPRESA, sistemaDe } from "@/lib/sistema/datos";

export const metadata: Metadata = { title: "Sistema · Verse App" };

const cuando = (f: Date | null) =>
  f ? f.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }) : "nunca";
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const ESTADO_RESPALDO = { completo: "Completo", con_fallas: "Con fallas", en_curso: "En curso" } as const;

async function Panel({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const sesion = await sesionActual();
  const { empresa: pedida } = await searchParams;
  const conSistema = empresasVisibles(sesion).filter((e) => SISTEMA_POR_EMPRESA[e] && puede(sesion, e, SISTEMA_POR_EMPRESA[e]!, "ver"));
  const empresa = conSistema.includes(pedida ?? "") ? pedida! : conSistema[0];
  if (!empresa) return <p>No tienes acceso a Sistema.</p>;
  const s = (await sistemaDe(db(), sesion, empresa))!;
  const nombre = (id: string) => sesion.estructura?.find((e) => e.id === id)?.nombre ?? id;

  return (
    <>
      <p>
        <Link href="/hoy" className="text-[var(--verse-azul)] underline">
          Hoy
        </Link>{" "}
        · Sistema
      </p>
      {conSistema.length > 1 && (
        <nav aria-label="Empresa" className="flex gap-2">
          {conSistema.map((id) => (
            <Link
              key={id}
              href={`/sistema?empresa=${id}`}
              aria-current={id === empresa ? "page" : undefined}
              className={`rounded-full px-3 py-1 font-display text-sm ${id === empresa ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              {nombre(id)}
            </Link>
          ))}
        </nav>
      )}

      <Seccion titulo={`Fallas · ${s.fallas.length}`}>
        {s.fallas.length === 0 ? (
          <p>Sin fallas en los últimos 7 días.</p>
        ) : (
          <ul className="divide-y divide-[var(--verse-filete-suave)]">
            {s.fallas.map((f, i) => (
              <li key={i} className="py-2">
                <b className="text-foreground">{f.tipo}</b> · {f.texto}
                <div className="text-[12.5px] text-muted-foreground">{cuando(f.cuando)}</div>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {s.app && (
        <>
          <Seccion titulo="Sincronización con Airtable">
            <p>
              Noches seguidas con la copia cuadrando: <b className="text-foreground">{s.app.nochesSeguidas}</b> de 3 para cerrar la entrega 0.
            </p>
            <ul className="divide-y divide-[var(--verse-filete-suave)]">
              {s.app.tablas.map((t) => (
                <li key={t.clave} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    <b className="text-foreground">{t.nombre}</b> · {t.filas} filas
                    <span className="block text-[12.5px] text-muted-foreground">
                      Reconciliada {cuando(t.ultimaReconciliacion)} · webhook vence {cuando(t.webhookVence)}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-[12px]" aria-label="Últimas 3 noches">
                    {t.noches.map((ok) => (ok ? "Sí" : "No")).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            {s.app.colaFallidas > 0 && <p>Escrituras rechazadas por Airtable en 7 días: {s.app.colaFallidas}.</p>}
          </Seccion>

          <Seccion titulo="Respaldo en Drive">
            {s.app.respaldos.length === 0 ? (
              <p>Todavía no hay respaldos.</p>
            ) : (
              <ul className="divide-y divide-[var(--verse-filete-suave)]">
                {s.app.respaldos.map((r) => (
                  <li key={r.fecha} className="py-2">
                    <b className="text-foreground">{r.fecha}</b> · {ESTADO_RESPALDO[r.estado]} · {r.hechas} de {r.tablas} tablas · {r.filas} filas ·{" "}
                    {mb(r.bytes)} · {r.adjuntos} adjuntos ({mb(r.bytesAdjuntos)})
                    {r.carpetaId && (
                      <>
                        {" "}
                        ·{" "}
                        <a className="text-[var(--verse-azul)] underline" href={`https://drive.google.com/drive/folders/${r.carpetaId}`} target="_blank" rel="noreferrer">
                          carpeta
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion titulo="Llamadas a Airtable y costo">
            {s.app.llamadas.length === 0 ? (
              <p>Sin llamadas registradas.</p>
            ) : (
              <ul className="text-[13.5px]">
                {s.app.llamadas.map((l) => (
                  <li key={`${l.dia}-${l.workspace}`}>
                    {l.dia} · {l.workspace} · {l.llamadas} llamadas
                  </li>
                ))}
              </ul>
            )}
            <p>{s.app.neon ? `Neon en el período: US$${s.app.neon.usdTotal} (${s.app.neon.horasComputo} h de cómputo).` : "Neon: sin medir (falta NEON_API_KEY)."}</p>
          </Seccion>
        </>
      )}

      <Seccion titulo={`Corridas de los últimos 7 días · ${s.corridas.length}`}>
        <ul className="divide-y divide-[var(--verse-filete-suave)]">
          {s.corridas.map((c) => (
            <li key={c.recId} className="py-2">
              <div className="flex justify-between gap-3">
                <b className="text-foreground">{c.asunto}</b>
                <span className="shrink-0 text-[12.5px]">{c.estado}</span>
              </div>
              <div className="text-[12.5px] text-muted-foreground">
                {c.proceso} · {cuando(c.creado)}
              </div>
            </li>
          ))}
        </ul>
      </Seccion>
    </>
  );
}

export default function Sistema({ searchParams }: PageProps<"/sistema">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <Encabezado submarca="SISTEMA" />
      <Tarjeta>
        <Suspense fallback={<p className="text-muted-foreground">Cargando</p>}>
          <Panel searchParams={searchParams as Promise<{ empresa?: string }>} />
        </Suspense>
      </Tarjeta>
    </main>
  );
}

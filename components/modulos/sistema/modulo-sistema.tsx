import { sumarDias } from "@/lib/vistas/periodo";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { usoDesde } from "@/lib/medicion/uso";
import { db } from "@/db/cliente";
import type { Sesion } from "@/lib/acceso/permisos";
import { sistemaDe } from "@/lib/sistema/datos";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EncabezadoModulo } from "../encabezado";

const cuando = (f: Date | null) =>
  f ? f.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }) : "Nunca";
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const ESTADO_RESPALDO = { completo: "Completo", con_fallas: "Con fallas", en_curso: "En curso" } as const;

function Indicador({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{valor}</p>
      {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}

function Bloque({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-medium">{titulo}</h2>
        {accion}
      </header>
      {children}
    </section>
  );
}

/** Sistema: fallas, sincronización, respaldo, costo y corridas de la empresa. */
export async function ModuloSistema({ sesion, empresa, enAjustes = false }: { sesion: Sesion; empresa: string; enAjustes?: boolean }) {
  const s = await sistemaDe(db(), sesion, empresa);
  if (!s) return enAjustes ? <p className="text-sm text-muted-foreground">Sin datos de Sistema para esta empresa.</p> : <EncabezadoModulo titulo="Sistema" descripcion="Tu acceso no incluye Sistema en esta empresa." />;
  const ultimo = s.app?.respaldos[0];

  return (
    <>
      {!enAjustes && <EncabezadoModulo titulo="Sistema" descripcion="Salud de la sincronización, respaldos, costo y corridas de los últimos 7 días" />}
      <div className={enAjustes ? "space-y-4" : "space-y-4 px-4 pb-10 md:px-6"}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador titulo="Fallas en 7 días" valor={String(s.fallas.length)} nota={s.fallas.length ? "Revisa la lista de fallas" : "Todo en orden"} />
          {s.app && <Indicador titulo="Noches cuadrando" valor={`${s.app.nochesSeguidas} de 3`} nota="Copia contra Airtable" />}
          {s.app && <Indicador titulo="Último respaldo" valor={ultimo ? ESTADO_RESPALDO[ultimo.estado] : "Sin respaldo"} nota={ultimo ? `${ultimo.fecha} · ${ultimo.hechas} de ${ultimo.tablas} tablas` : undefined} />}
          {s.app && (
            <Indicador
              titulo="Asistente en 7 días"
              valor={`US$${s.app.asistente.costoUsd}`}
              nota={s.app.asistente.preguntas ? `${s.app.asistente.preguntas} preguntas · US$${s.app.asistente.porPregunta} cada una` : "Sin preguntas"}
            />
          )}
        </div>

        {s.fallas.length > 0 && (
          <Bloque titulo="Fallas">
            <ul className="divide-y text-sm">
              {s.fallas.map((f, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                  <span>
                    <Badge variant="destructive" className="mr-2">
                      {f.tipo}
                    </Badge>
                    {f.texto}
                  </span>
                  <span className="text-xs text-muted-foreground">{cuando(f.cuando)}</span>
                </li>
              ))}
            </ul>
          </Bloque>
        )}

        {s.app && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Bloque titulo="Sincronización con Airtable" accion={s.app.colaFallidas > 0 ? <Badge variant="destructive">{s.app.colaFallidas} escrituras rechazadas</Badge> : undefined}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Tabla</TableHead>
                    <TableHead className="text-right">Filas</TableHead>
                    <TableHead>Reconciliada</TableHead>
                    <TableHead className="pr-4">3 noches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.app.tablas.map((t) => (
                    <TableRow key={t.clave}>
                      <TableCell className="pl-4 font-medium">{t.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.filas}</TableCell>
                      <TableCell className="text-muted-foreground">{cuando(t.ultimaReconciliacion)}</TableCell>
                      <TableCell className="pr-4">
                        <span className="flex gap-1" aria-label={`Últimas noches: ${t.noches.map((ok) => (ok ? "cuadró" : "no cuadró")).join(", ")}`}>
                          {t.noches.map((ok, i) => (
                            <span key={i} className={`size-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                          ))}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Bloque>

            <Bloque titulo="Respaldo en Drive">
              {s.app.respaldos.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Todavía no hay respaldos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Filas</TableHead>
                      <TableHead className="pr-4 text-right">Tamaño</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.app.respaldos.map((r) => (
                      <TableRow key={r.fecha}>
                        <TableCell className="pl-4 font-medium">
                          {r.carpetaId ? (
                            <a className="underline-offset-2 hover:underline" href={`https://drive.google.com/drive/folders/${r.carpetaId}`} target="_blank" rel="noreferrer">
                              {r.fecha}
                            </a>
                          ) : (
                            r.fecha
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.estado === "completo" ? "secondary" : r.estado === "con_fallas" ? "destructive" : "outline"}>{ESTADO_RESPALDO[r.estado]}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.filas}</TableCell>
                        <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">{mb(r.bytes + r.bytesAdjuntos)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Bloque>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <Bloque titulo={`Corridas · ${s.corridas.length}`}>
            {s.corridas.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Sin corridas en 7 días.</p>
            ) : (
              <ul className="divide-y text-sm">
                {s.corridas.map((c) => (
                  <li key={c.recId} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.asunto}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.proceso} · {cuando(c.creado)}
                      </span>
                    </span>
                    <Badge variant={c.estado === "OK" ? "secondary" : c.estado === "Falló" ? "destructive" : "outline"}>{c.estado}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Bloque>
          {s.app && (
            <Bloque titulo="Llamadas a Airtable y costo">
              <div className="space-y-3 p-4 text-sm">
                {s.app.llamadas.length === 0 ? (
                  <p className="text-muted-foreground">Sin llamadas registradas.</p>
                ) : (
                  <ul className="space-y-1 tabular-nums">
                    {s.app.llamadas.map((l) => (
                      <li key={`${l.dia}-${l.workspace}`} className="flex justify-between">
                        <span className="text-muted-foreground">
                          {l.dia} · {l.workspace}
                        </span>
                        <span>{l.llamadas}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-muted-foreground">{s.app.neon ? `Neon en el período: US$${s.app.neon.usdTotal} (${s.app.neon.horasComputo} h de cómputo).` : "Neon: sin medir todavía."}</p>
              </div>
            </Bloque>
          )}
        </div>
        {sesion.maestro && <UsoApp />}
      </div>
    </>
  );
}

/** Qué se usa y quién, últimos 7 días (solo el Maestro). */
const segundos = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} s`);

async function UsoApp() {
  const desde = sumarDias(hoyBogota(), -6);
  const u = await usoDesde(db(), desde).catch(() => null);
  if (!u) return null;
  return (
    <Bloque titulo="Uso de la app en 7 días">
      <div className="grid gap-4 p-4 text-sm md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Pantallas: visitas, personas y carga promedio (rojo si pasa de 1 s)</p>
          {u.porPantalla.length === 0 ? (
            <p className="text-muted-foreground">Sin visitas todavía.</p>
          ) : (
            <ul className="space-y-1 tabular-nums">
              {u.porPantalla.map((p) => (
                <li key={p.ruta} className="flex justify-between gap-2">
                  <span className="truncate text-muted-foreground">{p.ruta}</span>
                  <span className="shrink-0">
                    {p.vistas} · {p.personas} {p.personas === 1 ? "persona" : "personas"}
                    {p.msPromedio !== null && (
                      <span className={p.msPromedio > 1000 ? " text-red-600 dark:text-red-400" : " text-muted-foreground"} title={`Máximo ${segundos(p.msMax)}`}>
                        {" "}
                        · {segundos(p.msPromedio)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Personas</p>
          <ul className="space-y-1 tabular-nums">
            {u.porPersona.map((p) => (
              <li key={p.correo} className="flex justify-between gap-2">
                <span className="truncate">{p.nombre}</span>
                <span className="text-muted-foreground">
                  {p.vistas} visitas · {p.dias} {p.dias === 1 ? "día" : "días"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Bloque>
  );
}

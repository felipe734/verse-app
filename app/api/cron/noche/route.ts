import { eq } from "drizzle-orm";
import { db } from "@/db/cliente";
import { respaldos } from "@/db/esquema";
import { procesarCola } from "@/lib/airtable/cola";
import { auditar } from "@/lib/auditoria";
import { registrarCorrida } from "@/lib/corridas";
import { detalleApp } from "@/lib/corridas-texto";
import { leerEntorno } from "@/lib/entorno";
import { crearContador, diaBogota } from "@/lib/medicion/contador";
import { guardarCostoNeon, leerCostoNeon, type CostoNeon } from "@/lib/medicion/neon";
import { clienteServidor, esCronAutorizado, urlWebhook } from "@/lib/servidor/airtable";
import { reconciliar, type ResultadoReconciliacion } from "@/lib/sync/reconciliar";
import { CLAVES } from "@/lib/sync/tablas";
import { mantenerWebhooks } from "@/lib/sync/webhooks";

export const maxDuration = 300;

/**
 * Reconciliación nocturna: copia contra Airtable fila por fila, webhooks al día y cola vacía.
 * Revisa el respaldo de la noche anterior y deja la Corrida "App" (solo con CORRIDAS_ACTIVAS=1).
 */
export async function GET(request: Request) {
  if (!esCronAutorizado(request)) return new Response("No autorizado", { status: 401 });

  const base = db();
  const contador = crearContador();
  const cliente = clienteServidor(contador);
  const resultados: ResultadoReconciliacion[] = [];
  const errores: string[] = [];

  for (const clave of CLAVES) {
    try {
      resultados.push(await reconciliar(base, cliente, clave));
    } catch (e) {
      errores.push(`${clave}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  let webhooks: Awaited<ReturnType<typeof mantenerWebhooks>> | null = null;
  try {
    webhooks = await mantenerWebhooks(base, cliente, {
      activos: process.env.WEBHOOKS_ACTIVOS === "1",
      url: urlWebhook(),
    });
  } catch (e) {
    errores.push(`webhooks: ${e instanceof Error ? e.message : "error"}`);
  }

  const cola = await procesarCola(base, cliente, 100);

  let neon: CostoNeon | null = null;
  const { NEON_API_KEY, NEON_PROJECT_ID } = leerEntorno();
  if (NEON_API_KEY && NEON_PROJECT_ID) {
    try {
      neon = await leerCostoNeon({ apiKey: NEON_API_KEY, idProyecto: NEON_PROJECT_ID });
      await guardarCostoNeon(base, neon);
    } catch (e) {
      errores.push(`neon: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  // Este cron (2:00) corre antes del respaldo (2:30): revisa que el de la noche anterior haya terminado.
  const hoy = diaBogota();
  const ayer = diaBogota(new Date(Date.now() - 24 * 3600_000));
  const [respaldoAyer] = await base.select().from(respaldos).where(eq(respaldos.fecha, ayer));
  const estadoRespaldo = !respaldoAyer ? "no corrió" : respaldoAyer.estado === "en_curso" ? "no terminó" : respaldoAyer.estado;
  const respaldoMal = !respaldoAyer || respaldoAyer.estado === "en_curso";

  const llamadas = contador.porWorkspace();
  const todoBien = errores.length === 0 && !respaldoMal;
  await registrarCorrida(base, cliente, {
    proceso: "App",
    asunto: todoBien ? "Sincronización de la app al día" : "Sincronización de la app con pendientes",
    estado: todoBien ? "OK" : "Con pendientes",
    detalle: detalleApp(resultados, {
      llamadas,
      neonUsd: neon?.usdTotal ?? null,
      errores,
      respaldoAyer: estadoRespaldo,
      webhooks: webhooks?.renovados.length ?? 0,
    }),
    mes: hoy.slice(0, 7),
    pendiente: respaldoMal
      ? { asunto: "Respaldo de Airtable por revisar", accion: `Revisar el respaldo de Airtable del ${ayer}: ${estadoRespaldo}`, fechaLimite: hoy }
      : { asunto: "Sincronización de la app por revisar", accion: `Revisar la sincronización de la app del ${hoy}`, fechaLimite: hoy },
  }).catch((e: unknown) => errores.push(`corrida: ${e instanceof Error ? e.message : "error"}`));

  await contador.volcar(base);

  const informe = { resultados, webhooks, cola, llamadas, neon, respaldoAyer: estadoRespaldo, errores };
  // Resumen sin datos de negocio ni secretos: solo conteos, para verificar cada corrida en los logs de Vercel.
  console.info(
    "[cron/noche]",
    JSON.stringify({
      tablas: resultados.map((r) => ({ clave: r.clave, airtable: r.filasAirtable, copia: r.filasCopia, faltaban: r.faltaban, sobraban: r.sobraban, distintas: r.distintas, cuadra: r.cuadra })),
      webhooks,
      cola,
      llamadas,
      neonUsd: neon?.usdTotal ?? null,
      respaldoAyer: estadoRespaldo,
      errores,
    }),
  );
  await auditar(base, { autor: "sistema", accion: "sync.reconciliacion", detalle: JSON.stringify(informe) });
  return Response.json(informe, { status: errores.length ? 500 : 200 });
}

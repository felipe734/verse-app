import { db } from "@/db/cliente";
import { procesarCola } from "@/lib/airtable/cola";
import { auditar } from "@/lib/auditoria";
import { leerEntorno } from "@/lib/entorno";
import { crearContador } from "@/lib/medicion/contador";
import { guardarCostoNeon, leerCostoNeon, type CostoNeon } from "@/lib/medicion/neon";
import { clienteServidor, esCronAutorizado, urlWebhook } from "@/lib/servidor/airtable";
import { reconciliar, type ResultadoReconciliacion } from "@/lib/sync/reconciliar";
import { CLAVES } from "@/lib/sync/tablas";
import { mantenerWebhooks } from "@/lib/sync/webhooks";

export const maxDuration = 300;

/** Reconciliación nocturna: copia contra Airtable fila por fila, webhooks al día y cola vacía. */
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

  const llamadas = contador.porWorkspace();
  await contador.volcar(base);

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

  const informe = { resultados, webhooks, cola, llamadas, neon, errores };
  await auditar(base, { autor: "sistema", accion: "sync.reconciliacion", detalle: JSON.stringify(informe) });
  return Response.json(informe, { status: errores.length ? 500 : 200 });
}

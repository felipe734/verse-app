import { db } from "@/db/cliente";
import { procesarCola } from "@/lib/airtable/cola";
import { auditar } from "@/lib/auditoria";
import { clienteServidor, esCronAutorizado, urlWebhook } from "@/lib/servidor/airtable";
import { reconciliar, type ResultadoReconciliacion } from "@/lib/sync/reconciliar";
import { CLAVES } from "@/lib/sync/tablas";
import { mantenerWebhooks } from "@/lib/sync/webhooks";

export const maxDuration = 300;

/** Reconciliación nocturna: copia contra Airtable fila por fila, webhooks al día y cola vacía. */
export async function GET(request: Request) {
  if (!esCronAutorizado(request)) return new Response("No autorizado", { status: 401 });

  const base = db();
  const cliente = clienteServidor();
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
  await auditar(base, {
    autor: "sistema",
    accion: "sync.reconciliacion",
    detalle: JSON.stringify({ resultados, webhooks, cola, errores }),
  });

  return Response.json({ resultados, webhooks, cola, errores }, { status: errores.length ? 500 : 200 });
}

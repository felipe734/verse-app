import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/cliente";
import { syncEstado } from "@/db/esquema";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";
import { aplicarAviso, firmaValida } from "@/lib/sync/webhooks";

export const maxDuration = 60;

/** Aviso de Airtable: valida la firma y aplica los cambios después de responder. */
export async function POST(request: Request) {
  const cuerpo = await request.text();
  let webhookId: string | undefined;
  try {
    webhookId = (JSON.parse(cuerpo) as { webhook?: { id?: string } }).webhook?.id;
  } catch {
    return new Response("Cuerpo inválido", { status: 400 });
  }
  if (!webhookId) return new Response("Sin webhook", { status: 400 });

  const base = db();
  const [estado] = await base.select().from(syncEstado).where(eq(syncEstado.webhookId, webhookId));
  if (!estado?.webhookMac) return new Response("Webhook desconocido", { status: 404 });
  if (!firmaValida(cuerpo, request.headers.get("x-airtable-content-mac"), estado.webhookMac)) {
    return new Response("Firma inválida", { status: 401 });
  }

  after(async () => {
    const contador = crearContador();
    try {
      await aplicarAviso(base, clienteServidor(contador), webhookId);
      await contador.volcar(base);
    } catch (e) {
      await base
        .update(syncEstado)
        .set({ error: e instanceof Error ? e.message : "error" })
        .where(eq(syncEstado.webhookId, webhookId));
    }
  });
  return new Response(null, { status: 204 });
}

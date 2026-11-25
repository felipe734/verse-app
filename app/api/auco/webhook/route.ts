import { timingSafeEqual } from "node:crypto";
import { db } from "@/db/cliente";
import { llamarAuco, secretoWebhook } from "@/lib/firma/auco";
import { procesarAviso } from "@/lib/firma/firma";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";

export const maxDuration = 60;

const iguales = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Aviso de Auco (firma de contratos): valida el encabezado secreto y consulta el estado real en Auco. */
export async function POST(request: Request) {
  const secreto = secretoWebhook();
  const auco = llamarAuco();
  if (!secreto || !auco) return Response.json({ error: "Auco no está conectado" }, { status: 503 });
  if (!iguales(request.headers.get("x-verse-webhook") ?? "", secreto)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const ev = (await request.json().catch(() => ({}))) as { code?: string; status?: string };
  const contador = crearContador();
  try {
    const r = await procesarAviso(db(), clienteServidor(contador, { fresco: true }), auco, ev);
    await contador.volcar(db());
    return Response.json(r);
  } catch (e) {
    console.error("[auco/webhook]", e instanceof Error ? e.message : e);
    // 200 para que Auco no reintente sin fin; el estado real se vuelve a leer en el próximo aviso.
    return Response.json({ ok: false });
  }
}

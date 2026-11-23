import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { conversar, type Evento } from "@/lib/asistente/bucle";
import { empresasDelAsistente } from "@/lib/asistente/herramientas";
import { modeloPara } from "@/lib/asistente/precios";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";
import { llamarClaude } from "@/lib/servidor/claude";
import { composioServidor } from "@/lib/servidor/composio";

export const maxDuration = 300;

const Pedido = z.object({
  texto: z.string().trim().min(1).max(4000),
  conversacionId: z.string().uuid().nullish(),
  pantalla: z.object({ ruta: z.string().max(300), seleccion: z.string().max(200).nullish() }).optional(),
});

/** Conversación con el asistente; responde en NDJSON (un evento por línea) mientras llega el texto. */
export async function POST(request: Request) {
  const sesion = await sesionActual();
  if (empresasDelAsistente(sesion).length === 0) return new Response("Tu acceso no incluye el asistente", { status: 403 });
  const llamar = llamarClaude();
  if (!llamar) return new Response("El asistente no está configurado (falta ANTHROPIC_API_KEY)", { status: 503 });
  const pedido = Pedido.safeParse(await request.json().catch(() => null));
  if (!pedido.success) return new Response("Pedido inválido", { status: 400 });

  const codificador = new TextEncoder();
  const flujo = new ReadableStream<Uint8Array>({
    async start(control) {
      const enviar = (e: Evento) => control.enqueue(codificador.encode(`${JSON.stringify(e)}\n`));
      try {
        const contador = crearContador();
        await conversar({
          db: db(),
          sesion,
          llamar,
          texto: pedido.data.texto,
          pantalla: pedido.data.pantalla,
          conversacionId: pedido.data.conversacionId,
          modelo: modeloPara(pedido.data.texto),
          airtable: clienteServidor(contador),
          composio: composioServidor() ?? undefined,
          alEvento: enviar,
        });
        await contador.volcar(db());
      } catch (e) {
        const texto =
          e instanceof Anthropic.RateLimitError
            ? "El asistente está ocupado. Intenta en un minuto."
            : e instanceof Anthropic.APIError
              ? "El asistente no respondió. Intenta de nuevo."
              : "Algo falló en la app. Intenta de nuevo.";
        console.error("[asistente]", e instanceof Error ? e.message : e);
        enviar({ tipo: "aviso", texto });
        enviar({ tipo: "fin", costoUsd: 0 });
      } finally {
        control.close();
      }
    },
  });
  return new Response(flujo, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

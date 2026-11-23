import Anthropic from "@anthropic-ai/sdk";
import type { Llamar } from "@/lib/asistente/bucle";

/** Cliente de la API de Claude con la clave de Vercel. Sin clave, el asistente queda apagado. */
export function llamarClaude(): Llamar | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  return async (params, alTexto) => {
    const stream = client.beta.messages.stream(params);
    stream.on("text", alTexto);
    return stream.finalMessage();
  };
}

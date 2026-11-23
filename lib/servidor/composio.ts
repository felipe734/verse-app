import { clienteComposio, type ClienteComposio } from "@/lib/correo/composio";

/** Cliente de Composio con la clave de Vercel. Sin clave, el correo queda apagado. */
export function composioServidor(): ClienteComposio | null {
  const clave = process.env.COMPOSIO_API_KEY;
  return clave ? clienteComposio(clave) : null;
}

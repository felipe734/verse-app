import { clienteComposio, type ClienteComposio } from "@/lib/correo/composio";
import { esVitrina } from "@/lib/vitrina/activa";
import { composioVitrina } from "@/lib/vitrina/composio";

/** Cliente de Composio con la clave de Vercel. Sin clave, el correo queda apagado. En la vitrina, correo inventado. */
export function composioServidor(): ClienteComposio | null {
  if (esVitrina()) return composioVitrina();
  // Una clave pegada con espacios, saltos o comillas de más da 401: se limpia.
  const clave = process.env.COMPOSIO_API_KEY?.trim().replace(/^["']|["']$/g, "");
  return clave ? clienteComposio(clave) : null;
}

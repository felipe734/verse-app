import { clienteComposio, type ClienteComposio } from "@/lib/correo/composio";
import { esVitrina } from "@/lib/vitrina/activa";
import { composioVitrina } from "@/lib/vitrina/composio";

/** Cliente de Composio con la clave de Vercel. Sin clave, el correo queda apagado. En la vitrina, correo inventado. */
export function composioServidor(): ClienteComposio | null {
  if (esVitrina()) return composioVitrina();
  const clave = process.env.COMPOSIO_API_KEY;
  return clave ? clienteComposio(clave) : null;
}

import { crearCliente, type ClienteAirtable } from "@/lib/airtable/cliente";
import { exigir, leerEntorno } from "@/lib/entorno";
import type { Contador } from "@/lib/medicion/contador";

/** Cliente de Airtable del servidor. Cada llamada se cuenta por base y workspace. */
export function clienteServidor(contador?: Contador): ClienteAirtable {
  return crearCliente({ token: exigir(leerEntorno(), "AIRTABLE_TOKEN"), alLlamar: contador?.contar });
}

/** Dominio público de producción (app.verseliving.com). Las URL de despliegue piden inicio de sesión de Vercel. */
export function urlProduccion(ruta: string): string {
  const host = process.env.APP_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!host) throw new Error("No se sabe la URL de producción.");
  return `${host.startsWith("http") ? host : `https://${host}`}${ruta}`;
}

export function urlWebhook(): string {
  return urlProduccion("/api/airtable/webhook");
}

/** Vercel Cron manda `Authorization: Bearer CRON_SECRET`. */
export function esCronAutorizado(request: Request): boolean {
  const secreto = leerEntorno().CRON_SECRET;
  return Boolean(secreto) && request.headers.get("authorization") === `Bearer ${secreto}`;
}

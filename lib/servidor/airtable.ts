import { crearCliente, type ClienteAirtable } from "@/lib/airtable/cliente";
import { exigir, leerEntorno } from "@/lib/entorno";
import type { Contador } from "@/lib/medicion/contador";
import { airtableVitrina } from "@/lib/vitrina/airtable";
import { alEscribirEnAirtable } from "@/lib/airtable/cola";
import { consultarCacheado, vencerTabla } from "./cache-airtable";

alEscribirEnAirtable(vencerTabla);
import { esVitrina } from "@/lib/vitrina/activa";

/**
 * Cliente de Airtable del servidor. Cada llamada se cuenta por base y workspace. Las consultas
 * de los módulos pasan por una caché de 60 segundos; con `fresco` (turnos, reportes) van
 * directo a Airtable.
 */
export function clienteServidor(contador?: Contador, opciones: { fresco?: boolean } = {}): ClienteAirtable {
  if (esVitrina()) return airtableVitrina();
  const cliente = crearCliente({ token: exigir(leerEntorno(), "AIRTABLE_TOKEN"), alLlamar: contador?.contar });
  if (opciones.fresco || process.env.APP_SIN_CACHE === "1") return cliente;
  return { ...cliente, consultar: async (idBase, idTabla, o) => (await consultarCacheado(idBase, idTabla, o)).filas };
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

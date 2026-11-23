import { z } from "zod";

/**
 * Variables de entorno del servidor. Viven en Vercel, nunca en el repo.
 * Cada entrega agrega las suyas; las que aún no existen son opcionales.
 */
const esquema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AIRTABLE_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  NEON_API_KEY: z.string().min(1).optional(),
  NEON_PROJECT_ID: z.string().min(1).optional(),
  WEBHOOKS_ACTIVOS: z.enum(["0", "1"]).optional(),
});

export type Entorno = z.infer<typeof esquema>;

export function leerEntorno(fuente: Record<string, string | undefined> = process.env): Entorno {
  return esquema.parse(fuente);
}

export function exigir<K extends keyof Entorno>(entorno: Entorno, clave: K): NonNullable<Entorno[K]> {
  const valor = entorno[clave];
  if (valor === undefined || valor === null) {
    throw new Error(`Falta la variable ${String(clave)}. Créala en Vercel.`);
  }
  return valor as NonNullable<Entorno[K]>;
}

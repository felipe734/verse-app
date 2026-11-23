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
  GCP_PROJECT_NUMBER: z.string().min(1).optional(),
  GCP_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GCP_WORKLOAD_IDENTITY_POOL_ID: z.string().min(1).optional(),
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: z.string().min(1).optional(),
  RESPALDO_DRIVE_ID: z.string().min(1).optional(),
  // Interruptores: se activan solo con el valor exacto "1". Texto libre para que un valor
  // distinto no tumbe todas las rutas al validar el entorno.
  WEBHOOKS_ACTIVOS: z.string().optional(),
  LECTURA_COPIA: z.string().optional(),
  CORRIDAS_ACTIVAS: z.string().optional(),
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

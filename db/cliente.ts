import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as esquema from "./esquema";

export type Db = PgDatabase<PgQueryResultHKT, typeof esquema>;

let instancia: Db | undefined;

/** Conexión a Neon por HTTP. Se crea al primer uso para no fallar en build sin DATABASE_URL. */
export function db(): Db {
  // Vitrina de Playwright: Postgres en memoria preparado en instrumentation.ts.
  const vitrina = (globalThis as { __dbVitrina?: Db }).__dbVitrina;
  if (vitrina && process.env.APP_E2E === "1" && !process.env.VERCEL) return vitrina;
  if (!instancia) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Falta la variable DATABASE_URL. Créala en Vercel.");
    instancia = drizzleNeon(neon(url), { schema: esquema }) as unknown as Db;
  }
  return instancia;
}

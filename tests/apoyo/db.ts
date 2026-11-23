import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db/cliente";
import * as esquema from "@/db/esquema";

/** Postgres en memoria con las mismas migraciones que Neon. */
export async function dbDePrueba(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema: esquema });
  await migrate(db, { migrationsFolder: "db/migraciones" });
  return db as unknown as Db;
}

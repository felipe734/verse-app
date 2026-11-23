import type { Db } from "@/db/cliente";
import { auditoria } from "@/db/esquema";

export type EntradaAuditoria = typeof auditoria.$inferInsert;

/** Todo deja rastro: cada escritura y cada cambio de acceso pasa por aquí. */
export async function auditar(db: Db, entrada: EntradaAuditoria): Promise<void> {
  await db.insert(auditoria).values(entrada);
}

import { sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { llamadasAirtable } from "@/db/esquema";
import { CATALOGO } from "@/lib/airtable/mapeo";

const workspacePorBase = new Map<string, string>(CATALOGO.map((f) => [f.idBase, f.workspace]));

export function workspaceDe(idBase: string): string {
  return workspacePorBase.get(idBase) ?? "Desconocido";
}

/** Día en Bogotá (UTC−5), que es como se leen los reportes. */
export function diaBogota(fecha = new Date()): string {
  return new Date(fecha.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
}

/** Cuenta llamadas en memoria durante una petición y las suma a Postgres al final. */
export function crearContador() {
  const porBase = new Map<string, number>();
  return {
    contar(idBase: string) {
      porBase.set(idBase, (porBase.get(idBase) ?? 0) + 1);
    },
    total(): number {
      return [...porBase.values()].reduce((a, b) => a + b, 0);
    },
    porWorkspace(): Record<string, number> {
      const r: Record<string, number> = {};
      for (const [b, n] of porBase) r[workspaceDe(b)] = (r[workspaceDe(b)] ?? 0) + n;
      return r;
    },
    /** Suma a Postgres y vacía el contador: lee total() o porWorkspace() antes. */
    async volcar(db: Db, fecha = new Date()): Promise<void> {
      const dia = diaBogota(fecha);
      for (const [idBase, n] of porBase) {
        await db
          .insert(llamadasAirtable)
          .values({ dia, workspace: workspaceDe(idBase), idBase, llamadas: n })
          .onConflictDoUpdate({
            target: [llamadasAirtable.dia, llamadasAirtable.workspace, llamadasAirtable.idBase],
            set: { llamadas: sql`${llamadasAirtable.llamadas} + ${n}` },
          });
      }
      porBase.clear();
    },
  };
}

export type Contador = ReturnType<typeof crearContador>;

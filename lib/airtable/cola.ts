import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import { auditar } from "@/lib/auditoria";
import { guardar } from "@/lib/sync/guardar";
import { iguales } from "@/lib/sync/huella";
import { claveDe } from "@/lib/sync/tablas";
import { ErrorAirtable, type ClienteAirtable } from "./cliente";

export const MAX_INTENTOS = 5;

export interface Escritura {
  idBase: string;
  idTabla: string;
  /** Vacío para crear. */
  recId?: string;
  /** Campos por ID, siempre desde el mapeo. */
  campos: Record<string, unknown>;
  /** Lo que el usuario vio antes de editar. Si Airtable ya tiene otra cosa, gana Airtable. */
  esperado?: Record<string, unknown>;
  autor: string;
}

/** Deja una escritura en la cola. Nada va directo a Airtable. */
export async function encolar(db: Db, e: Escritura): Promise<number> {
  const [fila] = await db
    .insert(colaEscrituras)
    .values({
      idBase: e.idBase,
      idTabla: e.idTabla,
      recId: e.recId ?? null,
      operacion: e.recId ? "actualizar" : "crear",
      campos: e.campos,
      esperado: e.esperado ?? null,
      autor: e.autor,
    })
    .returning({ id: colaEscrituras.id });
  return fila!.id;
}

export interface ResultadoCola {
  hechas: number;
  rechazadas: number;
  reintentos: number;
}

/** Toma escrituras pendientes sin chocar con otro trabajador y las envía a Airtable. */
export async function procesarCola(db: Db, cliente: ClienteAirtable, limite = 25): Promise<ResultadoCola> {
  const libres = db
    .select({ id: colaEscrituras.id })
    .from(colaEscrituras)
    .where(and(eq(colaEscrituras.estado, "pendiente"), lte(colaEscrituras.proximoIntento, sql`now()`)))
    .orderBy(asc(colaEscrituras.id))
    .limit(limite)
    .for("update", { skipLocked: true });

  const tomadas = await db
    .update(colaEscrituras)
    .set({ estado: "enviando", intentos: sql`${colaEscrituras.intentos} + 1` })
    .where(inArray(colaEscrituras.id, libres))
    .returning();
  tomadas.sort((a, b) => a.id - b.id);

  const r: ResultadoCola = { hechas: 0, rechazadas: 0, reintentos: 0 };
  for (const t of tomadas) {
    const base = { autor: t.autor, idBase: t.idBase, idTabla: t.idTabla };
    try {
      let antes: Record<string, unknown> | null = null;
      if (t.operacion === "actualizar" && t.recId) {
        const actual = await cliente.obtener(t.idBase, t.idTabla, t.recId);
        if (!actual) throw new Rechazo("la fila ya no existe en Airtable");
        antes = Object.fromEntries(Object.keys(t.campos).map((k) => [k, actual.fields[k] ?? null]));
        if (t.esperado) {
          const cambio = Object.keys(t.esperado).some((k) => !iguales(actual.fields[k], t.esperado![k]));
          if (cambio) {
            const clave = claveDe(t.idBase, t.idTabla);
            if (clave) await guardar(db, clave, [actual]);
            throw new Rechazo("la fila cambió en Airtable; se deja el valor de Airtable");
          }
        }
      }

      const resultado =
        t.operacion === "crear"
          ? await cliente.crear(t.idBase, t.idTabla, t.campos)
          : await cliente.actualizar(t.idBase, t.idTabla, t.recId!, t.campos);

      const clave = claveDe(t.idBase, t.idTabla);
      if (clave) await guardar(db, clave, [resultado]);
      await db
        .update(colaEscrituras)
        .set({ estado: "hecha", recId: resultado.id, error: null, procesado: sql`now()` })
        .where(eq(colaEscrituras.id, t.id));
      await auditar(db, { ...base, accion: `escritura.${t.operacion}`, recId: resultado.id, antes, despues: t.campos });
      r.hechas++;
    } catch (e) {
      const reintentable = e instanceof ErrorAirtable && e.reintentable && t.intentos < MAX_INTENTOS;
      const mensaje = e instanceof Error ? e.message : "error desconocido";
      if (reintentable) {
        const espera = 2 ** t.intentos * 1000;
        await db
          .update(colaEscrituras)
          .set({ estado: "pendiente", error: mensaje, proximoIntento: sql`now() + ${`${espera} milliseconds`}::interval` })
          .where(eq(colaEscrituras.id, t.id));
        r.reintentos++;
      } else {
        await db
          .update(colaEscrituras)
          .set({ estado: "fallida", error: mensaje, procesado: sql`now()` })
          .where(eq(colaEscrituras.id, t.id));
        await auditar(db, { ...base, accion: "escritura.rechazada", recId: t.recId, despues: t.campos, detalle: mensaje });
        r.rechazadas++;
      }
    }
  }
  return r;
}

class Rechazo extends Error {
  override name = "Rechazo";
}

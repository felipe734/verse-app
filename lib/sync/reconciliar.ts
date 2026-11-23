import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { reconciliaciones, registros, syncEstado } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import type { ClaveTabla } from "@/lib/airtable/definicion";
import { TABLAS } from "@/lib/airtable/mapeo";
import { borrar, guardar } from "./guardar";
import { huella } from "./huella";

export interface ResultadoReconciliacion {
  clave: ClaveTabla;
  filasAirtable: number;
  filasCopia: number;
  faltaban: number;
  sobraban: number;
  distintas: number;
  cuadra: boolean;
}

/**
 * Compara Airtable con la copia fila por fila, corrige las diferencias y deja el resultado.
 * Con la copia vacía es la carga completa.
 */
export async function reconciliar(db: Db, cliente: ClienteAirtable, clave: ClaveTabla): Promise<ResultadoReconciliacion> {
  const { idBase, idTabla } = TABLAS[clave];
  const enAirtable = await cliente.todos(idBase, idTabla);
  const enCopia = await db
    .select({ recId: registros.recId, huella: registros.huella })
    .from(registros)
    .where(and(eq(registros.idBase, idBase), eq(registros.idTabla, idTabla)));

  const copia = new Map(enCopia.map((r) => [r.recId, r.huella]));
  const vistos = new Set<string>();
  const porGuardar = [];
  let faltaban = 0;
  let distintas = 0;
  for (const r of enAirtable) {
    vistos.add(r.id);
    const h = copia.get(r.id);
    if (h === undefined) {
      faltaban++;
      porGuardar.push(r);
    } else if (h !== huella(r.fields)) {
      distintas++;
      porGuardar.push(r);
    }
  }
  const sobrantes = enCopia.filter((r) => !vistos.has(r.recId)).map((r) => r.recId);

  await guardar(db, clave, porGuardar);
  await borrar(db, clave, sobrantes);

  const resultado: ResultadoReconciliacion = {
    clave,
    filasAirtable: enAirtable.length,
    filasCopia: enCopia.length,
    faltaban,
    sobraban: sobrantes.length,
    distintas,
    cuadra: faltaban === 0 && sobrantes.length === 0 && distintas === 0,
  };

  await db.insert(reconciliaciones).values({
    clave,
    filasAirtable: resultado.filasAirtable,
    filasCopia: resultado.filasCopia,
    faltaban,
    sobraban: resultado.sobraban,
    distintas,
    cuadra: resultado.cuadra,
  });
  await db
    .insert(syncEstado)
    .values({ clave, idBase, idTabla, filas: enAirtable.length, ultimaCarga: new Date(), ultimaReconciliacion: new Date() })
    .onConflictDoUpdate({
      target: syncEstado.clave,
      set: {
        filas: enAirtable.length,
        ultimaReconciliacion: sql`now()`,
        ultimaCarga: sql`coalesce(${syncEstado.ultimaCarga}, now())`,
        error: null,
      },
    });

  return resultado;
}

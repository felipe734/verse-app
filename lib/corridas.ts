import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { TABLAS } from "@/lib/airtable/mapeo";

export type EstadoCorrida = "OK" | "Con pendientes" | "Falló";

export interface Corrida {
  /** Proceso deseado; si la opción no existe en TRAZABILIDAD VERSE se usa "Verse OS". */
  proceso: "Respaldo" | "App";
  asunto: string;
  estado: EstadoCorrida;
  detalle: string;
  link?: string;
  mes: string;
  /**
   * Si el estado no es OK, se deja también un Pendiente para Felipe. Asunto sin fechas
   * (regla de verse-trazabilidad); `accion` es la primera línea del Detalle, verbo primero.
   */
  pendiente?: { asunto: string; accion: string; fechaLimite: string };
}

export const PROCESO_RESPALDO = "Verse OS";
const AUTOR = "app@verse";

/** Las corridas solo se escriben con CORRIDAS_ACTIVAS=1 (escritura en Airtable con OK de Felipe). */
export function corridasActivas(): boolean {
  return process.env.CORRIDAS_ACTIVAS === "1";
}

async function procesoDisponible(cliente: ClienteAirtable, deseado: string): Promise<string> {
  const t = TABLAS.trazabilidadVerse;
  const tabla = (await cliente.esquema(t.idBase)).find((x) => x.id === t.idTabla);
  const opciones = tabla?.fields.find((f) => f.id === t.campos.proceso.id)?.options?.choices ?? [];
  return opciones.some((o) => o.name === deseado) ? deseado : PROCESO_RESPALDO;
}

/**
 * Deja la Corrida en TRAZABILIDAD VERSE por la cola (con autor y auditoría) y, si algo falló,
 * un Pendiente enlazado. Devuelve null si las corridas están apagadas.
 */
export async function registrarCorrida(db: Db, cliente: ClienteAirtable, c: Corrida): Promise<{ corrida: string; pendiente?: string } | null> {
  if (!corridasActivas()) return null;
  const t = TABLAS.trazabilidadVerse;
  const k = t.campos;
  const proceso = await procesoDisponible(cliente, c.proceso);

  const base = {
    [k.tipo.id]: "Corrida",
    [k.proceso.id]: proceso,
    [k.estado.id]: c.estado,
    [k.responsable.id]: "Felipe",
    [k.linea.id]: "Grupo",
    [k.mes.id]: c.mes,
    [k.asunto.id]: c.asunto,
    [k.detalle.id]: c.detalle,
    ...(c.link ? { [k.link.id]: c.link } : {}),
  };
  const idCorrida = await encolar(db, { idBase: t.idBase, idTabla: t.idTabla, campos: base, autor: AUTOR });
  await procesarCola(db, cliente);
  const recCorrida = await recDe(db, idCorrida);
  if (!recCorrida) throw new Error("No se pudo escribir la Corrida en TRAZABILIDAD VERSE");

  if (c.estado === "OK" || !c.pendiente) return { corrida: recCorrida };
  const idPendiente = await encolar(db, {
    idBase: t.idBase,
    idTabla: t.idTabla,
    campos: {
      [k.tipo.id]: "Pendiente",
      [k.proceso.id]: proceso,
      [k.estado.id]: "Abierto",
      [k.responsable.id]: "Felipe",
      [k.linea.id]: "Grupo",
      [k.mes.id]: c.mes,
      [k.asunto.id]: c.pendiente.asunto,
      [k.fechaLimite.id]: c.pendiente.fechaLimite,
      [k.detalle.id]: `${c.pendiente.accion}\n${c.detalle}`,
      [k.corrida.id]: [recCorrida],
    },
    autor: AUTOR,
  });
  await procesarCola(db, cliente);
  return { corrida: recCorrida, pendiente: (await recDe(db, idPendiente)) ?? undefined };
}

async function recDe(db: Db, idCola: number): Promise<string | null> {
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, idCola));
  return fila?.estado === "hecha" ? fila.recId : null;
}

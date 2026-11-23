import type { Db } from "@/db/cliente";
import { costosNeon } from "@/db/esquema";
import { diaBogota } from "./contador";

/** Precios del plan Launch de Neon (doc del plan). Revisar si Neon los cambia. */
export const PRECIOS_LAUNCH = { usdPorHoraComputo: 0.106, usdPorGbMes: 0.35 } as const;

interface ProyectoNeon {
  compute_time_seconds?: number;
  synthetic_storage_size?: number;
  consumption_period_start?: string;
}

export interface CostoNeon {
  periodoInicio: string | null;
  horasComputo: number;
  gbAlmacenamiento: number;
  usdComputo: number;
  usdAlmacenamiento: number;
  usdTotal: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Costo estimado del período a la fecha. El almacenamiento se cobra como si el tamaño actual durara todo el mes. */
export function calcularCosto(p: ProyectoNeon, precios = PRECIOS_LAUNCH): CostoNeon {
  const horasComputo = (p.compute_time_seconds ?? 0) / 3600;
  const gbAlmacenamiento = (p.synthetic_storage_size ?? 0) / 1024 ** 3;
  const usdComputo = redondear(horasComputo * precios.usdPorHoraComputo);
  const usdAlmacenamiento = redondear(gbAlmacenamiento * precios.usdPorGbMes);
  return {
    periodoInicio: p.consumption_period_start ?? null,
    horasComputo: Math.round(horasComputo * 1000) / 1000,
    gbAlmacenamiento: Math.round(gbAlmacenamiento * 1000) / 1000,
    usdComputo,
    usdAlmacenamiento,
    usdTotal: redondear(usdComputo + usdAlmacenamiento),
  };
}

export async function leerCostoNeon(
  { apiKey, idProyecto }: { apiKey: string; idProyecto: string },
  f: typeof fetch = fetch,
): Promise<CostoNeon> {
  const r = await f(`https://console.neon.tech/api/v2/projects/${idProyecto}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Neon respondió ${r.status}`);
  const { project } = (await r.json()) as { project: ProyectoNeon };
  return calcularCosto(project);
}

export async function guardarCostoNeon(db: Db, c: CostoNeon, fecha = new Date()): Promise<void> {
  const fila = {
    dia: diaBogota(fecha),
    periodoInicio: c.periodoInicio ? new Date(c.periodoInicio) : null,
    horasComputo: c.horasComputo,
    gbAlmacenamiento: c.gbAlmacenamiento,
    usdComputo: c.usdComputo,
    usdAlmacenamiento: c.usdAlmacenamiento,
    usdTotal: c.usdTotal,
  };
  await db.insert(costosNeon).values(fila).onConflictDoUpdate({ target: costosNeon.dia, set: fila });
}

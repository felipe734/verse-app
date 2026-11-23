/**
 * Prueba en vivo: cada campo que piden los módulos de tabla existe en Airtable con ese nombre.
 * Solo lee esquemas. Necesita AIRTABLE_TOKEN.
 */
import { describe, expect, it } from "vitest";
import { crearCliente } from "@/lib/airtable/cliente";
import { PESTANAS } from "@/lib/modulos/finanzas";
import type { DefTabla } from "@/lib/modulos/tabla";
import { ids, TABLAS_EQUIPO } from "@/lib/modulos/tablas-equipo";

describe("módulos de tabla contra Airtable", () => {
  it("todos los campos existen", async () => {
    const token = process.env.AIRTABLE_TOKEN;
    if (!token) throw new Error("Falta AIRTABLE_TOKEN para la prueba en vivo.");
    const cliente = crearCliente({ token });
    const faltan: string[] = [];
    const cache = new Map<string, Awaited<ReturnType<typeof cliente.esquema>>>();
    const agregado: DefTabla = { ...ids("2. FACTURACION", "AGREGADO"), titulo: "Fecha", columnas: ["TOTAL INGRESOS", "CONTRIBUCIÓN TOTAL", "OVERHEAD COSTO", "MARGEN NETO"].map((campo) => ({ campo })) };
    const todas: (readonly [string, DefTabla])[] = [
      ...Object.entries(TABLAS_EQUIPO),
      ...Object.entries(PESTANAS).flatMap(([tipo, lista]) => lista.map((p) => [`${tipo}/${p.id}`, p.tabla] as const)),
      ["finanzas/cierre", agregado] as const,
    ];
    for (const [tipo, def] of todas) {
      if (!cache.has(def.idBase)) cache.set(def.idBase, await cliente.esquema(def.idBase));
      const tabla = cache.get(def.idBase)!.find((t) => t.id === def.idTabla);
      if (!tabla) {
        faltan.push(`${tipo}: tabla ${def.idTabla}`);
        continue;
      }
      const nombres = new Set(tabla.fields.map((f) => f.name));
      for (const c of [{ campo: def.titulo }, ...def.columnas, ...(def.detalle ?? []), ...(def.orden ? [{ campo: def.orden.campo }] : [])]) {
        if (!nombres.has(c.campo)) faltan.push(`${tipo}: ${c.campo}`);
      }
    }
    expect(faltan).toEqual([]);
  });
});

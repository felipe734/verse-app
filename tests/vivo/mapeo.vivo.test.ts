/**
 * Prueba en vivo: falla si un ID del mapeo ya no existe en Airtable.
 * Solo lee. Necesita AIRTABLE_TOKEN (secreto de GitHub y variable de Vercel).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { crearCliente } from "@/lib/airtable/cliente";
import type { EsquemaTabla } from "@/lib/airtable/construir-mapeo";
import { CATALOGO, TABLAS } from "@/lib/airtable/mapeo";

const token = process.env.AIRTABLE_TOKEN;
const esquemas = new Map<string, EsquemaTabla[]>();

describe("mapeo contra Airtable", () => {
  beforeAll(async () => {
    if (!token) throw new Error("Falta AIRTABLE_TOKEN para la prueba en vivo.");
    const cliente = crearCliente({ token });
    const bases = new Set<string>([
      ...Object.values(TABLAS).map((t) => t.idBase),
      ...CATALOGO.map((f) => f.idBase),
    ]);
    for (const id of bases) esquemas.set(id, await cliente.esquema(id));
  }, 120_000);

  it("cada tabla del catálogo existe", () => {
    const faltan = CATALOGO.filter(
      (f) => !esquemas.get(f.idBase)?.some((t) => t.id === f.idTabla),
    ).map((f) => `${f.base} / ${f.tabla} (${f.idTabla})`);
    expect(faltan).toEqual([]);
  });

  it("cada campo mapeado existe en su tabla", () => {
    const faltan: string[] = [];
    for (const t of Object.values(TABLAS)) {
      const esquema = esquemas.get(t.idBase)?.find((x) => x.id === t.idTabla);
      for (const c of Object.values(t.campos)) {
        if (!esquema?.fields.some((f) => f.id === c.id)) faltan.push(`${t.base} / ${t.tabla} / ${c.nombre} (${c.id})`);
      }
    }
    expect(faltan).toEqual([]);
  });
});

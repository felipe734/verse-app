import type { RegistroAirtable } from "@/lib/airtable/cliente";
import type { EsquemaTabla } from "@/lib/airtable/construir-mapeo";

export interface ExportacionTabla {
  json: string;
  csv: string;
  filas: number;
}

function celda(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          return String(o.name ?? o.filename ?? o.url ?? o.id ?? JSON.stringify(o));
        }
        return String(x);
      })
      .join("; ");
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o.name ?? o.label ?? JSON.stringify(o));
  }
  return String(v);
}

function csvEscapar(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** JSON fiel (campos por ID + esquema para restaurar) y CSV legible (columnas por nombre). */
export function exportarTabla(esquema: EsquemaTabla, registros: RegistroAirtable[], meta: Record<string, string>): ExportacionTabla {
  const json = JSON.stringify({ ...meta, esquema, registros }, null, 0);
  const columnas = esquema.fields;
  const filas = [
    ["recId", "creado", ...columnas.map((c) => c.name)].map(csvEscapar).join(","),
    ...registros.map((r) =>
      [r.id, r.createdTime, ...columnas.map((c) => celda(r.fields[c.id]))].map(csvEscapar).join(","),
    ),
  ];
  // BOM para que Excel abra bien las tildes.
  return { json, csv: `﻿${filas.join("\r\n")}\r\n`, filas: registros.length };
}

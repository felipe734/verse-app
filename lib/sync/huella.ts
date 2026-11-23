import { createHash } from "node:crypto";

function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, ordenar((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/** Huella estable de los campos de una fila: igual contenido, igual huella, sin importar el orden. */
export function huella(campos: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(ordenar(campos))).digest("hex");
}

export function iguales(a: unknown, b: unknown): boolean {
  return JSON.stringify(ordenar(a ?? null)) === JSON.stringify(ordenar(b ?? null));
}

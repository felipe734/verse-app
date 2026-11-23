import { TABLAS } from "@/lib/airtable/mapeo";
import type { ClaveTabla } from "@/lib/airtable/definicion";
import type { RegistroAirtable } from "@/lib/airtable/cliente";
import type { tareas, unidades } from "@/db/esquema";

type Tarea = typeof tareas.$inferInsert;
type Unidad = typeof unidades.$inferInsert;

/** Las copias de lectura (reservas, limpiezas, ingresos) solo viven en `registros`. */
export type Proyeccion = { tipo: "tarea"; fila: Tarea } | { tipo: "unidad"; fila: Unidad } | { tipo: "ninguna" };

const txt = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => txt(x)).filter(Boolean).join(", ") || null;
  if (typeof v === "object" && "name" in v) return String((v as { name: unknown }).name);
  return null;
};
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const fecha = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function tarea(clave: "trazabilidadVerse" | "trazabilidadCyC", r: RegistroAirtable): Tarea {
  const c = TABLAS[clave].campos;
  const f = r.fields;
  return {
    recId: r.id,
    empresa: clave === "trazabilidadVerse" ? "Verse" : "C&C",
    numero: num(f[c.id.id]),
    tipo: txt(f[c.tipo.id]),
    asunto: txt(f[c.asunto.id]),
    proceso: txt(f[c.proceso.id]),
    estado: txt(f[c.estado.id]),
    responsable: txt(f[c.responsable.id]),
    fechaLimite: fecha(f[c.fechaLimite.id]),
    detalle: txt(f[c.detalle.id]),
    link: txt(f[c.link.id]),
    linea: txt(f[c.linea.id]),
    creado: r.createdTime ? new Date(r.createdTime) : null,
    corrida: ids(f[c.corrida.id]),
  };
}

function unidadHost(r: RegistroAirtable): Unidad {
  const c = TABLAS.unidadesHost.campos;
  const und = txt(r.fields[c.und.id]);
  // UND es la fórmula "Unidad - Edificio": de ahí sale el nombre del edificio sin otra llamada.
  const edificio = und?.includes(" - ") ? und.split(" - ").slice(1).join(" - ") : null;
  return {
    recId: r.id,
    linea: "Host",
    unidad: txt(r.fields[c.unidad.id]) ?? und,
    edificio,
    estado: txt(r.fields[c.estado.id]),
  };
}

function unidadLiving(r: RegistroAirtable): Unidad {
  const c = TABLAS.unidadesLiving.campos;
  return {
    recId: r.id,
    linea: "Living",
    unidad: txt(r.fields[c.unidad.id]),
    edificio: null,
    estado: txt(r.fields[c.estado.id]),
  };
}

export function proyectar(clave: ClaveTabla, r: RegistroAirtable): Proyeccion {
  switch (clave) {
    case "trazabilidadVerse":
    case "trazabilidadCyC":
      return { tipo: "tarea", fila: tarea(clave, r) };
    case "unidadesHost":
      return { tipo: "unidad", fila: unidadHost(r) };
    case "unidadesLiving":
      return { tipo: "unidad", fila: unidadLiving(r) };
    case "reservasHost":
    case "limpiezasHost":
    case "ingresosLivingCopia":
    case "unidadesOperacionCopia":
      return { tipo: "ninguna" };
  }
}

export function claveDe(idBase: string, idTabla: string): ClaveTabla | null {
  for (const [clave, t] of Object.entries(TABLAS)) {
    if (t.idBase === idBase && t.idTabla === idTabla) return clave as ClaveTabla;
  }
  return null;
}

export const CLAVES = Object.keys(TABLAS) as ClaveTabla[];

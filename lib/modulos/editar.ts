import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { ESCRITURA, TABLAS } from "@/lib/airtable/mapeo";
import { puede, type Sesion } from "@/lib/acceso/permisos";

/**
 * Edición desde los módulos de tabla (plan aprobado por Felipe el 2026-11-23): estados y
 * comentarios, campo por campo, solo con el módulo en "editar". Los IDs salen del mapeo; las
 * opciones de un select, del esquema vivo de Airtable. Todo pasa por la cola con el valor que
 * la persona vio: si Airtable cambió entre tanto, gana Airtable. Nada se borra.
 */

type TablaMapeada = { idBase: string; idTabla: string; campos: Record<string, { id: string; nombre: string; tipo: string }> };
const MAPEADAS: Record<string, TablaMapeada> = { ...(TABLAS as unknown as Record<string, TablaMapeada>), ...((ESCRITURA ?? {}) as unknown as Record<string, TablaMapeada>) };

export interface CampoEditable {
  campo: string;
  etiqueta: string;
}

export interface DefEdicion {
  /** Clave de la tabla en el mapeo (TABLAS o ESCRITURA). */
  tabla: string;
  campos: CampoEditable[];
}

/** Tipos de Airtable que se editan aquí; un campo de otro tipo (fórmula, enlace) no se ofrece. */
const TIPOS = { singleSelect: "opciones", singleLineText: "texto", multilineText: "texto", checkbox: "casilla" } as const;
type TipoEdicion = (typeof TIPOS)[keyof typeof TIPOS];

export interface CampoFormulario {
  campo: string;
  etiqueta: string;
  tipo: TipoEdicion;
  valor: string | boolean;
  opciones?: string[];
}

export interface Formulario {
  campos: CampoFormulario[];
  /** Valores crudos por ID de campo, tal como estaban al abrir. */
  antes: Record<string, unknown>;
}

function resolver(def: DefEdicion) {
  const t = MAPEADAS[def.tabla];
  if (!t) throw new Error(`Tabla sin mapeo: ${def.tabla}`);
  const campos = def.campos
    .map((c) => ({ ...c, mapa: t.campos[c.campo] }))
    .filter((c): c is CampoEditable & { mapa: { id: string; nombre: string; tipo: string } } => Boolean(c.mapa && c.mapa.tipo in TIPOS));
  return { t, campos };
}

/** El campo editable cuya columna de Airtable se llama así (para mover tarjetas en el tablero). */
export function campoPorNombre(def: DefEdicion | undefined, nombre: string | undefined): string | null {
  if (!def || !nombre) return null;
  return resolver(def).campos.find((c) => c.mapa.nombre === nombre && c.mapa.tipo === "singleSelect")?.campo ?? null;
}

/** ID de Airtable de un campo editable. */
export function idDeCampo(def: DefEdicion, campo: string): string | null {
  return resolver(def).campos.find((c) => c.campo === campo)?.mapa.id ?? null;
}

/** Los campos que la definición ofrece y que de verdad se pueden editar (por tipo). */
export const camposEditables = (def: DefEdicion) => resolver(def).campos.map((c) => c.campo);

const esquemas = new Map<string, { vence: number; opciones: Map<string, string[]> }>();

/** Opciones de los selects de una base, desde el esquema vivo (10 minutos de memoria). */
async function opcionesDe(airtable: ClienteAirtable, idBase: string, ahora = Date.now()): Promise<Map<string, string[]>> {
  const c = esquemas.get(idBase);
  if (c && c.vence > ahora) return c.opciones;
  const opciones = new Map<string, string[]>();
  for (const tabla of await airtable.esquema(idBase))
    for (const f of tabla.fields as { id: string; options?: { choices?: { name: string }[] } }[]) if (f.options?.choices) opciones.set(f.id, f.options.choices.map((x) => x.name));
  esquemas.set(idBase, { vence: ahora + 10 * 60_000, opciones });
  return opciones;
}

export function olvidarEsquemas() {
  esquemas.clear();
}

const REC = /^rec[A-Za-z0-9]{14}$/;

export async function formularioEdicion(airtable: ClienteAirtable, s: Sesion, empresa: string, moduloId: string, def: DefEdicion, recId: string): Promise<Formulario | { error: string }> {
  if (!puede(s, empresa, moduloId, "editar")) return { error: "No puedes editar en este módulo" };
  if (!REC.test(recId)) return { error: "Fila inválida" };
  const { t, campos } = resolver(def);
  if (!campos.length) return { error: "Este módulo no tiene campos para editar" };
  const fila = await airtable.obtener(t.idBase, t.idTabla, recId);
  if (!fila) return { error: "La fila ya no existe en Airtable" };
  const opciones = campos.some((c) => c.mapa.tipo === "singleSelect") ? await opcionesDe(airtable, t.idBase) : new Map<string, string[]>();
  const antes: Record<string, unknown> = {};
  const lista: CampoFormulario[] = campos.map((c) => {
    const crudo = fila.fields[c.mapa.id] ?? null;
    antes[c.mapa.id] = crudo;
    const tipo = TIPOS[c.mapa.tipo as keyof typeof TIPOS];
    return {
      campo: c.campo,
      etiqueta: c.etiqueta,
      tipo,
      valor: tipo === "casilla" ? Boolean(crudo) : crudo === null ? "" : String(typeof crudo === "object" && crudo && "name" in crudo ? (crudo as { name: string }).name : crudo),
      ...(tipo === "opciones" ? { opciones: opciones.get(c.mapa.id) ?? [] } : {}),
    };
  });
  return { campos: lista, antes };
}

export interface Guardado {
  ok: boolean;
  mensaje: string;
}

export async function guardarEdicion(
  db: Db,
  airtable: ClienteAirtable,
  s: Sesion,
  empresa: string,
  moduloId: string,
  def: DefEdicion,
  recId: string,
  cambios: Record<string, string | boolean>,
  antes: Record<string, unknown>,
): Promise<Guardado> {
  if (!puede(s, empresa, moduloId, "editar")) return { ok: false, mensaje: "No puedes editar en este módulo" };
  if (!REC.test(recId)) return { ok: false, mensaje: "Fila inválida" };
  const { t, campos } = resolver(def);
  const campos_: Record<string, unknown> = {};
  const esperado: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(cambios)) {
    const c = campos.find((x) => x.campo === clave);
    if (!c) return { ok: false, mensaje: `No se puede editar "${clave}"` };
    const tipo = TIPOS[c.mapa.tipo as keyof typeof TIPOS];
    if (tipo === "casilla") {
      if (typeof valor !== "boolean") return { ok: false, mensaje: "Valor inválido" };
      campos_[c.mapa.id] = valor;
    } else {
      if (typeof valor !== "string" || valor.length > 5000) return { ok: false, mensaje: "Valor inválido" };
      if (tipo === "opciones" && valor && !(await opcionesDe(airtable, t.idBase)).get(c.mapa.id)?.includes(valor)) return { ok: false, mensaje: `"${valor}" no es una opción de ${c.etiqueta}` };
      campos_[c.mapa.id] = valor.trim() === "" ? null : tipo === "texto" ? valor.trim() : valor;
    }
    esperado[c.mapa.id] = antes[c.mapa.id] ?? null;
  }
  if (!Object.keys(campos_).length) return { ok: false, mensaje: "No hay cambios" };
  const id = await encolar(db, { idBase: t.idBase, idTabla: t.idTabla, recId, campos: campos_, esperado, autor: s.correo });
  await procesarCola(db, airtable);
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, id));
  if (fila?.estado === "hecha") return { ok: true, mensaje: "Guardado en Airtable" };
  if (fila?.estado === "pendiente") return { ok: true, mensaje: "Guardado. Airtable está ocupado: se envía en un momento" };
  return { ok: false, mensaje: fila?.error?.includes("cambió") ? "La fila cambió en Airtable mientras editabas; quedó el valor de Airtable" : "Airtable no aceptó el cambio" };
}

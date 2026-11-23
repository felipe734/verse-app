import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { puede, sensibles, type Sesion } from "@/lib/acceso/permisos";

/**
 * Crear filas desde un módulo (plan aprobado por Felipe el 2026-11-23): por ahora, gastos de
 * caja menor con la foto del soporte. Solo con el módulo en "editar" y la casilla de cifras
 * de General. Los IDs salen del mapeo; las opciones, del esquema vivo; el soporte, del
 * almacenamiento de la app. Todo pasa por la cola y queda en AUDITORIA.
 */

type TablaMapeada = { idBase: string; idTabla: string; campos: Record<string, { id: string; nombre: string; tipo: string }> };
const MAPEADAS = (ESCRITURA ?? {}) as unknown as Record<string, TablaMapeada>;

export interface CampoCreacion {
  campo: string;
  etiqueta: string;
  requerido?: boolean;
  defecto?: "hoy";
}

export interface DefCreacion {
  tabla: string;
  /** Texto del botón y del panel: "Nuevo gasto". */
  titulo: string;
  campos: CampoCreacion[];
}

const TIPOS = {
  singleSelect: "opciones",
  singleLineText: "texto",
  multilineText: "texto",
  currency: "numero",
  number: "numero",
  date: "fecha",
  multipleAttachments: "archivo",
} as const;
type TipoCreacion = (typeof TIPOS)[keyof typeof TIPOS];

export interface CampoNuevo {
  campo: string;
  etiqueta: string;
  tipo: TipoCreacion;
  requerido: boolean;
  defecto?: string;
  opciones?: string[];
}

function resolver(def: DefCreacion) {
  const t = MAPEADAS[def.tabla];
  if (!t) throw new Error(`Tabla sin mapeo: ${def.tabla}`);
  return {
    t,
    campos: def.campos
      .map((c) => ({ ...c, mapa: t.campos[c.campo] }))
      .filter((c): c is CampoCreacion & { mapa: { id: string; nombre: string; tipo: string } } => Boolean(c.mapa && c.mapa.tipo in TIPOS)),
  };
}

export const camposCreables = (def: DefCreacion) => resolver(def).campos.map((c) => c.campo);

function permiso(s: Sesion, empresa: string, moduloId: string): string | null {
  if (!puede(s, empresa, moduloId, "editar")) return "No puedes crear en este módulo";
  if (!sensibles(s, empresa, `${empresa}-general`).cifras) return "Tu acceso no incluye montos";
  return null;
}

const opcionesCache = new Map<string, { vence: number; opciones: Map<string, string[]> }>();
async function opcionesDe(airtable: ClienteAirtable, idBase: string, ahora = Date.now()) {
  const c = opcionesCache.get(idBase);
  if (c && c.vence > ahora) return c.opciones;
  const opciones = new Map<string, string[]>();
  for (const tabla of await airtable.esquema(idBase))
    for (const f of tabla.fields as { id: string; options?: { choices?: { name: string }[] } }[]) if (f.options?.choices) opciones.set(f.id, f.options.choices.map((x) => x.name));
  opcionesCache.set(idBase, { vence: ahora + 10 * 60_000, opciones });
  return opciones;
}

export function olvidarOpciones() {
  opcionesCache.clear();
}

export async function formularioCreacion(airtable: ClienteAirtable, s: Sesion, empresa: string, moduloId: string, def: DefCreacion, hoy: string): Promise<{ campos: CampoNuevo[] } | { error: string }> {
  const no = permiso(s, empresa, moduloId);
  if (no) return { error: no };
  const { t, campos } = resolver(def);
  const opciones = campos.some((c) => c.mapa.tipo === "singleSelect") ? await opcionesDe(airtable, t.idBase) : new Map<string, string[]>();
  return {
    campos: campos.map((c) => {
      const tipo = TIPOS[c.mapa.tipo as keyof typeof TIPOS];
      return {
        campo: c.campo,
        etiqueta: c.etiqueta,
        tipo,
        requerido: Boolean(c.requerido),
        ...(c.defecto === "hoy" ? { defecto: hoy } : {}),
        ...(tipo === "opciones" ? { opciones: opciones.get(c.mapa.id) ?? [] } : {}),
      };
    }),
  };
}

const ALMACEN = /\.blob\.vercel-storage\.com$/;

export async function crearFila(
  db: Db,
  airtable: ClienteAirtable,
  s: Sesion,
  empresa: string,
  moduloId: string,
  def: DefCreacion,
  valores: Record<string, unknown>,
): Promise<{ ok: boolean; mensaje: string }> {
  const no = permiso(s, empresa, moduloId);
  if (no) return { ok: false, mensaje: no };
  const { t, campos } = resolver(def);
  for (const clave of Object.keys(valores)) if (!campos.some((c) => c.campo === clave)) return { ok: false, mensaje: `No se puede escribir "${clave}"` };

  const fila: Record<string, unknown> = {};
  for (const c of campos) {
    const v = valores[c.campo];
    const vacio = v === undefined || v === null || (typeof v === "string" && !v.trim());
    if (vacio) {
      if (c.requerido) return { ok: false, mensaje: `Falta ${c.etiqueta.toLowerCase()}` };
      continue;
    }
    const tipo = TIPOS[c.mapa.tipo as keyof typeof TIPOS];
    if (tipo === "numero") {
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d,-]/g, "").replace(",", "."));
      if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) return { ok: false, mensaje: `${c.etiqueta} no es un monto válido` };
      fila[c.mapa.id] = n;
    } else if (tipo === "fecha") {
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, mensaje: `${c.etiqueta} no es una fecha válida` };
      fila[c.mapa.id] = v;
    } else if (tipo === "archivo") {
      const a = v as { url?: unknown; nombre?: unknown };
      if (typeof a?.url !== "string" || !URL.canParse(a.url) || !ALMACEN.test(new URL(a.url).hostname)) return { ok: false, mensaje: "El soporte no se subió bien. Súbelo otra vez" };
      fila[c.mapa.id] = [{ url: a.url, filename: String(a.nombre ?? "soporte").slice(0, 200) }];
    } else {
      if (typeof v !== "string" || v.length > 2000) return { ok: false, mensaje: `${c.etiqueta} no es válido` };
      if (tipo === "opciones" && !(await opcionesDe(airtable, t.idBase)).get(c.mapa.id)?.includes(v)) return { ok: false, mensaje: `"${v}" no es una opción de ${c.etiqueta}` };
      fila[c.mapa.id] = v.trim();
    }
  }

  const id = await encolar(db, { idBase: t.idBase, idTabla: t.idTabla, campos: fila, autor: s.correo });
  await procesarCola(db, airtable);
  const [r] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, id));
  if (r?.estado === "hecha") return { ok: true, mensaje: "Guardado en Airtable" };
  if (r?.estado === "pendiente") return { ok: true, mensaje: "Guardado. Airtable está ocupado: se envía en un momento" };
  return { ok: false, mensaje: "Airtable no aceptó el registro" };
}

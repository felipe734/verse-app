import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { puede, type Sesion } from "@/lib/acceso/permisos";
import { auditar } from "@/lib/auditoria";
import { funcionarias } from "@/lib/ruta/ruta";
import { ids } from "@/lib/modulos/tablas-equipo";
import { leerFecha } from "@/lib/vistas/fechas";
import { sumarDias } from "@/lib/vistas/periodo";

/**
 * Programación de aseos (fase 1.2, plan aprobado por Felipe el 2026-11-24). Desde Limpiezas,
 * con el módulo en editar: programar un aseo nuevo (de una salida sin aseo o a mano), asignar
 * la aseadora y mover la fecha u hora. Escribe solo campos que ya existen en LIMPIEZA: Unidad,
 * Fecha, Estado, Funcionario, Funcionaria enlace, Comentario, Total y Estado Pago. Todo por la
 * cola; al cambiar, con el valor que se veía (si Airtable cambió, gana Airtable). Nada se borra.
 */

export const MODULO_LIMPIEZAS = "host-limpiezas";
const L = ESCRITURA.limpieza;
const U = ESCRITURA.unidadesOperacion;
const DIAS = 7;

export interface Opcion {
  recId: string;
  nombre: string;
}

export interface Aseo {
  recId: string;
  unidad: string;
  fecha: string;
  /** "HH:MM" de 24 horas, en Bogotá. */
  hora: string;
  funcionaria: string;
  terminado: boolean;
}

export interface PorProgramar {
  unidad: string;
  unidadRecId: string | null;
  fecha: string;
}

export interface Programacion {
  hoy: string;
  funcionarias: Opcion[];
  unidades: Opcion[];
  porProgramar: PorProgramar[];
  aseos: Aseo[];
}

export interface Resultado {
  ok: boolean;
  mensaje: string;
}

const texto = (v: unknown): string => (v === null || v === undefined ? "" : Array.isArray(v) ? v.map(texto).filter(Boolean).join(", ") : String(v));
const literal = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const dia = (campo: string) => `DATETIME_FORMAT(SET_TIMEZONE({${campo}}, 'America/Bogota'), 'YYYY-MM-DD')`;
const REC = /^rec[A-Za-z0-9]{14}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const puedeProgramar = (s: Sesion) => puede(s, "verse", MODULO_LIMPIEZAS, "editar");

/** "1:30 p. m." → "13:30". */
export function hora24(h: string): string {
  const m = h.match(/^(\d{1,2}):(\d{2}) ([ap])/);
  if (!m) return "";
  const n = (Number(m[1]) % 12) + (m[3] === "p" ? 12 : 0);
  return `${String(n).padStart(2, "0")}:${m[2]}`;
}

/** Día y hora de Bogotá → ISO en UTC (Bogotá es UTC-5 todo el año). */
export const isoBogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`).toISOString();

/** "$ 120.000" o 120000 → 120000. */
export function monto(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const n = Number(texto(v).replace(/[^\d]/g, ""));
  return n > 0 ? n : null;
}

/** Aseos de [hoy, hoy+7) y salidas de esos días sin aseo de la misma unidad ese día. */
export async function programacion(airtable: ClienteAirtable, hoy: string): Promise<Programacion> {
  const R = ids("6. OPERACION 360", "RESERVAS");
  const hasta = sumarDias(hoy, DIAS - 1);
  const [fs, us, salidas, filas] = await Promise.all([
    funcionarias(airtable),
    airtable.consultar(U.idBase, U.idTabla, { campos: [U.campos.und.nombre], formula: `{${U.campos.estado.nombre}} = 'Actual'`, max: 300 }),
    airtable.consultar(R.idBase, R.idTabla, { campos: ["Unidad", "Salida"], formula: `AND({Salida}, ${dia("Salida")} >= '${hoy}', ${dia("Salida")} <= '${hasta}')`, max: 200 }),
    airtable.consultar(L.idBase, L.idTabla, {
      campos: [L.campos.unidad.nombre, L.campos.fecha.nombre, L.campos.funcionario.nombre, L.campos.funcionaria.nombre, L.campos.estado.nombre],
      formula: `AND({${L.campos.fecha.nombre}}, ${dia(L.campos.fecha.nombre)} >= '${hoy}', ${dia(L.campos.fecha.nombre)} <= '${hasta}')`,
      orden: { campo: L.campos.fecha.nombre, desc: false },
      max: 300,
    }),
  ]);
  const unidades = us.map((u) => ({ recId: u.id, nombre: texto(u.fields[U.campos.und.nombre]).trim() })).filter((u) => u.nombre);
  unidades.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const porNombre = new Map(unidades.map((u) => [u.nombre, u.recId]));

  const aseos: Aseo[] = filas
    .map((r) => {
      const f = leerFecha(texto(r.fields[L.campos.fecha.nombre]));
      return {
        recId: r.id,
        unidad: texto(r.fields[L.campos.unidad.nombre]),
        fecha: f?.fecha ?? "",
        hora: hora24(f?.hora ?? ""),
        funcionaria: texto(r.fields[L.campos.funcionaria.nombre]) || texto(r.fields[L.campos.funcionario.nombre]),
        terminado: texto(r.fields[L.campos.estado.nombre]) === "Terminado",
      };
    })
    .filter((a) => a.fecha)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  const hechos = new Set(aseos.map((a) => `${a.unidad}|${a.fecha}`));
  const vistos = new Set<string>();
  const porProgramar: PorProgramar[] = [];
  for (const r of salidas) {
    const unidad = texto(r.fields["Unidad"]);
    const fecha = leerFecha(texto(r.fields["Salida"]))?.fecha;
    const clave = `${unidad}|${fecha}`;
    if (!unidad || !fecha || hechos.has(clave) || vistos.has(clave)) continue;
    vistos.add(clave);
    porProgramar.push({ unidad, unidadRecId: porNombre.get(unidad) ?? null, fecha });
  }
  porProgramar.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.unidad.localeCompare(b.unidad, "es"));

  return {
    hoy,
    funcionarias: fs.filter((f) => f.activa).map((f) => ({ recId: f.recId, nombre: f.nombre })),
    unidades,
    porProgramar,
    aseos,
  };
}

async function escribir(db: Db, airtable: ClienteAirtable, s: Sesion, e: { recId?: string; campos: Record<string, unknown>; esperado?: Record<string, unknown> }) {
  const id = await encolar(db, { idBase: L.idBase, idTabla: L.idTabla, ...e, autor: s.correo });
  await procesarCola(db, airtable);
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, id));
  return { estado: fila?.estado, error: fila?.error ?? "", recId: fila?.recId ?? e.recId ?? null };
}

async function funcionariaPorId(airtable: ClienteAirtable, recId: string) {
  return (await funcionarias(airtable)).find((f) => f.recId === recId && f.activa) ?? null;
}

export interface NuevoAseo {
  unidad: string;
  fecha: string;
  hora: string;
  funcionaria?: string;
  comentario?: string;
}

/** Crea el aseo en LIMPIEZA si esa unidad no tiene otro ese día. */
export async function programarAseo(db: Db, airtable: ClienteAirtable, s: Sesion, n: NuevoAseo): Promise<Resultado> {
  if (!puedeProgramar(s)) return { ok: false, mensaje: "No puedes programar aseos" };
  if (!REC.test(n.unidad)) return { ok: false, mensaje: "Elige la unidad" };
  if (!FECHA.test(n.fecha)) return { ok: false, mensaje: "La fecha no es válida" };
  if (!HORA.test(n.hora)) return { ok: false, mensaje: "La hora no es válida" };
  if (n.funcionaria && !REC.test(n.funcionaria)) return { ok: false, mensaje: "Aseadora inválida" };
  if ((n.comentario?.length ?? 0) > 2000) return { ok: false, mensaje: "El comentario es muy largo" };

  const [u] = await airtable.porIds(U.idBase, U.idTabla, [n.unidad]);
  if (!u) return { ok: false, mensaje: "La unidad ya no existe en Airtable" };
  const nombre = texto(u.fields[U.campos.und.id]).trim();
  const repetido = await airtable.consultar(L.idBase, L.idTabla, {
    campos: [L.campos.unidad.nombre],
    formula: `AND(FIND('${literal(nombre)}', ARRAYJOIN({${L.campos.unidad.nombre}})), ${dia(L.campos.fecha.nombre)} = '${n.fecha}')`,
    max: 1,
  });
  if (repetido.length) return { ok: false, mensaje: `${nombre} ya tiene un aseo ese día` };
  const f = n.funcionaria ? await funcionariaPorId(airtable, n.funcionaria) : null;
  if (n.funcionaria && !f) return { ok: false, mensaje: "Esa aseadora no está activa en FUNCIONARIAS" };

  const total = monto(u.fields[U.campos.valorLimpieza.id]);
  const c = L.campos;
  const r = await escribir(db, airtable, s, {
    campos: {
      [c.unidad.id]: [n.unidad],
      [c.fecha.id]: isoBogota(n.fecha, n.hora),
      [c.estado.id]: "Programado",
      ...(f ? { [c.funcionaria.id]: [f.recId], ...(f.nombreLimpieza ? { [c.funcionario.id]: f.nombreLimpieza } : {}) } : {}),
      ...(total ? { [c.total.id]: total, [c.estadoPago.id]: "Pendiente" } : {}),
      ...(n.comentario?.trim() ? { [c.comentario.id]: n.comentario.trim() } : {}),
    },
  });
  if (r.estado !== "hecha" && r.estado !== "pendiente") return { ok: false, mensaje: "Airtable no aceptó el aseo" };
  await auditar(db, { autor: s.correo, accion: "aseos.programado", idBase: L.idBase, idTabla: L.idTabla, recId: r.recId, detalle: `${nombre} · ${n.fecha} ${n.hora}${f ? ` · ${f.nombre}` : ""}` });
  const cuando = `${Number(n.fecha.slice(8))}/${Number(n.fecha.slice(5, 7))} ${n.hora}`;
  return { ok: true, mensaje: r.estado === "pendiente" ? `${nombre} programado. Airtable lo guarda en un momento` : `${nombre} programado para el ${cuando}${f ? ` con ${f.nombre}` : ""}` };
}

export interface CambioAseo {
  recId: string;
  /** recId de FUNCIONARIAS, "" para quitarla, undefined para no tocarla. */
  funcionaria?: string;
  fecha?: string;
  hora?: string;
}

/** Cambia aseadora, fecha u hora de un aseo que no esté terminado. Si Airtable cambió, gana Airtable. */
export async function cambiarAseo(db: Db, airtable: ClienteAirtable, s: Sesion, c: CambioAseo): Promise<Resultado> {
  if (!puedeProgramar(s)) return { ok: false, mensaje: "No puedes programar aseos" };
  if (!REC.test(c.recId)) return { ok: false, mensaje: "Aseo inválido" };
  if (c.funcionaria && !REC.test(c.funcionaria)) return { ok: false, mensaje: "Aseadora inválida" };
  if ((c.fecha && !FECHA.test(c.fecha)) || (c.hora && !HORA.test(c.hora))) return { ok: false, mensaje: "La fecha u hora no es válida" };
  if (Boolean(c.fecha) !== Boolean(c.hora)) return { ok: false, mensaje: "Indica fecha y hora" };

  const fila = await airtable.obtener(L.idBase, L.idTabla, c.recId);
  if (!fila) return { ok: false, mensaje: "El aseo ya no existe en Airtable" };
  const k = L.campos;
  if (texto((fila.fields[k.estado.id] as { name?: string } | null)?.name ?? fila.fields[k.estado.id]) === "Terminado") return { ok: false, mensaje: "Ese aseo ya está terminado" };

  const campos: Record<string, unknown> = {};
  const esperado: Record<string, unknown> = {};
  let detalle = "";
  if (c.funcionaria !== undefined) {
    const f = c.funcionaria ? await funcionariaPorId(airtable, c.funcionaria) : null;
    if (c.funcionaria && !f) return { ok: false, mensaje: "Esa aseadora no está activa en FUNCIONARIAS" };
    campos[k.funcionaria.id] = f ? [f.recId] : [];
    campos[k.funcionario.id] = f?.nombreLimpieza || null;
    esperado[k.funcionaria.id] = fila.fields[k.funcionaria.id] ?? null;
    esperado[k.funcionario.id] = fila.fields[k.funcionario.id] ?? null;
    detalle = f ? `aseadora ${f.nombre}` : "sin aseadora";
  }
  if (c.fecha && c.hora) {
    campos[k.fecha.id] = isoBogota(c.fecha, c.hora);
    esperado[k.fecha.id] = fila.fields[k.fecha.id] ?? null;
    detalle = [detalle, `${c.fecha} ${c.hora}`].filter(Boolean).join(" · ");
  }
  if (!Object.keys(campos).length) return { ok: false, mensaje: "No hay cambios" };

  const r = await escribir(db, airtable, s, { recId: c.recId, campos, esperado });
  if (r.estado === "hecha" || r.estado === "pendiente") {
    await auditar(db, { autor: s.correo, accion: "aseos.cambiado", idBase: L.idBase, idTabla: L.idTabla, recId: c.recId, detalle });
    return { ok: true, mensaje: r.estado === "pendiente" ? "Guardado. Airtable lo recibe en un momento" : "Aseo actualizado" };
  }
  return { ok: false, mensaje: r.error.includes("cambió") ? "El aseo cambió en Airtable mientras lo editabas; quedó el valor de Airtable" : "Airtable no aceptó el cambio" };
}

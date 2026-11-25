import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { puede, sensibles, type Sesion } from "@/lib/acceso/permisos";
import { auditar } from "@/lib/auditoria";
import { abrirTicketsDeReporte } from "@/lib/tickets/tickets";

/**
 * Ruta de aseo (entrega 6). La funcionaria se reconoce por FUNCIONARIAS: su Nombre o su
 * Correo coinciden con el usuario de la app. Las limpiezas, servicios y turnos se enlazan a
 * esa fila ("Funcionaria enlace"); el select viejo se llena con la opción exacta de cada
 * tabla para que las skills sigan leyendo lo mismo. Todo se escribe por la cola.
 */

const F = ESCRITURA.funcionarias;
const L = ESCRITURA.limpieza;
const S = ESCRITURA.servicios;
const H = ESCRITURA.controlHoras;
const U = ESCRITURA.unidadesOperacion;
export const MODULO_RUTA = "host-ruta";

export interface Funcionaria {
  recId: string;
  nombre: string;
  nombreLimpieza: string;
  nombreServicios: string;
  nombreHoras: string;
}

export interface Parada {
  recId: string;
  unidad: string;
  hora: string;
  estado: string;
  comentario: string;
  terminada: boolean;
}

export interface Turno {
  recId: string;
  ingreso: string;
}

export interface DatosIngreso {
  metodo: string;
  codigo: string;
  candado: string;
  wifiRed: string;
  wifiClave: string;
}

const literal = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const texto = (v: unknown): string => (v === null || v === undefined ? "" : Array.isArray(v) ? v.map(texto).filter(Boolean).join(", ") : String(v));
const sinTilde = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Ve la ruta quien tiene el módulo; la opera (turno, reporte) solo la funcionaria. */
export const veRuta = (s: Sesion) => puede(s, "verse", MODULO_RUTA, "ver");

export async function funcionarias(airtable: ClienteAirtable): Promise<(Funcionaria & { activa: boolean; correo: string })[]> {
  const filas = await airtable.consultar(F.idBase, F.idTabla, {
    campos: [F.campos.nombre.nombre, F.campos.activa.nombre, F.campos.correo.nombre, F.campos.nombreLimpieza.nombre, F.campos.nombreServicios.nombre, F.campos.nombreHoras.nombre],
    max: 50,
  });
  return filas.map((r) => ({
    recId: r.id,
    nombre: texto(r.fields[F.campos.nombre.nombre]),
    activa: ["checked", "true", "1"].includes(texto(r.fields[F.campos.activa.nombre]).toLowerCase()),
    correo: texto(r.fields[F.campos.correo.nombre]).toLowerCase(),
    nombreLimpieza: texto(r.fields[F.campos.nombreLimpieza.nombre]),
    nombreServicios: texto(r.fields[F.campos.nombreServicios.nombre]),
    nombreHoras: texto(r.fields[F.campos.nombreHoras.nombre]),
  }));
}

/** La funcionaria de esta sesión: por correo y, si no, por el nombre en Airtable del usuario. */
export async function funcionariaDe(airtable: ClienteAirtable, s: Sesion): Promise<Funcionaria | null> {
  const lista = await funcionarias(airtable);
  const correo = s.correo.toLowerCase();
  const nombre = s.nombreAirtable ? sinTilde(s.nombreAirtable) : null;
  return lista.find((f) => f.correo && f.correo === correo) ?? (nombre ? (lista.find((f) => sinTilde(f.nombre) === nombre) ?? null) : null);
}

/** "23/11/2026 8:30am", "23/11/2026 13:30" → "8:30 a. m." o "1:30 p. m.". */
export function horaDe(fecha: string): string {
  const m = fecha.match(/(\d{1,2}):(\d{2})\s*([ap])?\.?\s*m?/i);
  if (!m) return "";
  let h = Number(m[1]);
  if (m[3]?.toLowerCase() === "p" && h < 12) h += 12;
  if (m[3]?.toLowerCase() === "a" && h === 12) h = 0;
  const sufijo = h < 12 ? "a. m." : "p. m.";
  return `${h % 12 || 12}:${m[2]} ${sufijo}`;
}

const minutos = (hora: string) => {
  const m = hora.match(/^(\d{1,2}):(\d{2}) ([ap])/);
  if (!m) return 24 * 60;
  return ((Number(m[1]) % 12) + (m[3] === "p" ? 12 : 0)) * 60 + Number(m[2]);
};

/** Las limpiezas de hoy de una funcionaria, en orden de hora. */
export async function rutaDe(airtable: ClienteAirtable, f: Pick<Funcionaria, "nombre">, hoy: string): Promise<Parada[]> {
  const enlace = L.campos.funcionaria.nombre;
  const fecha = L.campos.fecha.nombre;
  const filas = await airtable.consultar(L.idBase, L.idTabla, {
    campos: [L.campos.unidad.nombre, fecha, L.campos.estado.nombre, L.campos.comentario.nombre],
    formula: `AND(FIND('${literal(f.nombre)}', ARRAYJOIN({${enlace}})), DATETIME_FORMAT(SET_TIMEZONE({${fecha}}, 'America/Bogota'), 'YYYY-MM-DD') = '${hoy}')`,
    orden: { campo: fecha, desc: false },
    max: 20,
  });
  return filas
    .map((r) => {
      const estado = texto(r.fields[L.campos.estado.nombre]);
      return {
        recId: r.id,
        unidad: texto(r.fields[L.campos.unidad.nombre]),
        hora: horaDe(texto(r.fields[fecha])),
        estado,
        comentario: texto(r.fields[L.campos.comentario.nombre]),
        terminada: estado === "Terminado",
      };
    })
    .sort((a, b) => minutos(a.hora) - minutos(b.hora));
}

export interface FichaUnidad {
  edificio: string;
  metodo: string;
}

/**
 * Lo que la aseadora necesita saber de cada apartamento antes de ir (edificio y cómo se entra).
 * Códigos, candado y wifi siguen detrás del turno (datosIngreso).
 */
export async function fichasDe(airtable: ClienteAirtable, unidades: string[]): Promise<Record<string, FichaUnidad>> {
  const nombres = [...new Set(unidades.filter(Boolean))];
  if (!nombres.length) return {};
  const c = U.campos;
  const filas = await airtable.consultar(U.idBase, U.idTabla, {
    campos: [c.und.nombre, c.unidad.nombre, c.edificio.nombre, c.metodo.nombre],
    formula: `OR(${nombres.map((n) => `{${c.und.nombre}} = '${literal(n)}', {${c.unidad.nombre}} = '${literal(n)}'`).join(", ")})`,
    max: 50,
  });
  const r: Record<string, FichaUnidad> = {};
  for (const f of filas) {
    const ficha = { edificio: texto(f.fields[c.edificio.nombre]), metodo: texto(f.fields[c.metodo.nombre]) };
    for (const k of [texto(f.fields[c.und.nombre]), texto(f.fields[c.unidad.nombre])]) if (k) r[k] = ficha;
  }
  return r;
}

/** Limpiezas de un día sin funcionaria enlazada (para quien coordina). */
export async function sinFuncionaria(airtable: ClienteAirtable, fecha: string): Promise<Parada[]> {
  const f = L.campos.fecha.nombre;
  const filas = await airtable.consultar(L.idBase, L.idTabla, {
    campos: [L.campos.unidad.nombre, f, L.campos.estado.nombre, L.campos.comentario.nombre],
    formula: `AND({${L.campos.funcionaria.nombre}} = BLANK(), {${L.campos.funcionario.nombre}} = BLANK(), DATETIME_FORMAT(SET_TIMEZONE({${f}}, 'America/Bogota'), 'YYYY-MM-DD') = '${fecha}')`,
    orden: { campo: f, desc: false },
    max: 50,
  });
  return filas
    .map((r) => {
      const estado = texto(r.fields[L.campos.estado.nombre]);
      return { recId: r.id, unidad: texto(r.fields[L.campos.unidad.nombre]), hora: horaDe(texto(r.fields[f])), estado, comentario: texto(r.fields[L.campos.comentario.nombre]), terminada: estado === "Terminado" };
    })
    .sort((a, b) => minutos(a.hora) - minutos(b.hora));
}

/** El turno abierto de hoy (CONTROL HORAS sin Salida), si lo hay. */
export async function turnoAbierto(airtable: ClienteAirtable, f: Pick<Funcionaria, "nombre">, hoy: string): Promise<Turno | null> {
  const ingreso = H.campos.ingreso.nombre;
  const [t] = await airtable.consultar(H.idBase, H.idTabla, {
    campos: [ingreso, H.campos.salida.nombre],
    formula: `AND(FIND('${literal(f.nombre)}', ARRAYJOIN({${H.campos.funcionariaEnlace.nombre}})), {${H.campos.salida.nombre}} = BLANK(), DATETIME_FORMAT(SET_TIMEZONE({${ingreso}}, 'America/Bogota'), 'YYYY-MM-DD') = '${hoy}')`,
    orden: { campo: ingreso, desc: true },
    max: 1,
  });
  return t && !texto(t.fields[H.campos.salida.nombre]) ? { recId: t.id, ingreso: horaDe(texto(t.fields[ingreso])) } : null;
}

export interface Resultado {
  ok: boolean;
  mensaje: string;
}

async function escribir(db: Db, airtable: ClienteAirtable, s: Sesion, e: { idBase: string; idTabla: string; recId?: string; campos: Record<string, unknown> }): Promise<{ ok: boolean; pendiente: boolean; recId: string | null }> {
  const id = await encolar(db, { ...e, autor: s.correo });
  await procesarCola(db, airtable);
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, id));
  return { ok: fila?.estado === "hecha" || fila?.estado === "pendiente", pendiente: fila?.estado === "pendiente", recId: fila?.recId ?? null };
}

const ahoraIso = (ahora: Date) => ahora.toISOString();

export async function iniciarTurno(db: Db, airtable: ClienteAirtable, s: Sesion, hoy: string, ahora = new Date()): Promise<Resultado> {
  if (!puede(s, "verse", MODULO_RUTA, "editar")) return { ok: false, mensaje: "No tienes la Ruta de aseo" };
  const f = await funcionariaDe(airtable, s);
  if (!f) return { ok: false, mensaje: "Tu usuario no está en FUNCIONARIAS. Pídele a Diana que te agregue" };
  if (await turnoAbierto(airtable, f, hoy)) return { ok: false, mensaje: "Ya tienes un turno abierto" };
  const r = await escribir(db, airtable, s, {
    idBase: H.idBase,
    idTabla: H.idTabla,
    campos: {
      [H.campos.funcionariaEnlace.id]: [f.recId],
      ...(f.nombreHoras ? { [H.campos.funcionaria.id]: f.nombreHoras } : {}),
      [H.campos.ingreso.id]: ahoraIso(ahora),
      [H.campos.notas.id]: "Turno desde Verse App",
    },
  });
  if (!r.ok) return { ok: false, mensaje: "Airtable no aceptó el inicio del turno. Intenta de nuevo" };
  await auditar(db, { autor: s.correo, accion: "ruta.turno_iniciado", idBase: H.idBase, idTabla: H.idTabla, recId: r.recId, detalle: f.nombre });
  return { ok: true, mensaje: r.pendiente ? "Turno iniciado. Airtable lo guarda en un momento" : "Turno iniciado" };
}

export async function cerrarTurno(db: Db, airtable: ClienteAirtable, s: Sesion, hoy: string, ahora = new Date()): Promise<Resultado> {
  if (!puede(s, "verse", MODULO_RUTA, "editar")) return { ok: false, mensaje: "No tienes la Ruta de aseo" };
  const f = await funcionariaDe(airtable, s);
  if (!f) return { ok: false, mensaje: "Tu usuario no está en FUNCIONARIAS" };
  const t = await turnoAbierto(airtable, f, hoy);
  if (!t) return { ok: false, mensaje: "No tienes un turno abierto hoy" };
  const r = await escribir(db, airtable, s, { idBase: H.idBase, idTabla: H.idTabla, recId: t.recId, campos: { [H.campos.salida.id]: ahoraIso(ahora) } });
  if (!r.ok) return { ok: false, mensaje: "Airtable no aceptó el cierre del turno. Intenta de nuevo" };
  await auditar(db, { autor: s.correo, accion: "ruta.turno_cerrado", idBase: H.idBase, idTabla: H.idTabla, recId: t.recId, detalle: f.nombre });
  return { ok: true, mensaje: "Turno cerrado" };
}

/** La parada tiene que ser de esta funcionaria y de hoy: nada se abre ni se reporta fuera de su ruta. */
async function paradaPropia(airtable: ClienteAirtable, f: Funcionaria, hoy: string, recId: string): Promise<Parada | null> {
  return (await rutaDe(airtable, f, hoy)).find((p) => p.recId === recId) ?? null;
}

/**
 * Código, candado y wifi de la unidad de una parada. Con "Solo en su turno", solo con el
 * turno abierto y la limpieza de hoy en su ruta. Cada apertura queda en AUDITORIA.
 */
export async function datosIngreso(db: Db, airtable: ClienteAirtable, s: Sesion, hoy: string, limpieza: string): Promise<DatosIngreso | { error: string }> {
  const nivel = sensibles(s, "verse", "verse-host").codigos;
  if (nivel === "nunca") return { error: "Tu acceso no incluye códigos" };
  const f = await funcionariaDe(airtable, s);
  if (nivel === "turno") {
    if (!f) return { error: "Tu usuario no está en FUNCIONARIAS" };
    if (!(await paradaPropia(airtable, f, hoy, limpieza))) return { error: "Esa limpieza no está en tu ruta de hoy" };
    if (!(await turnoAbierto(airtable, f, hoy))) return { error: "Inicia el turno para ver los datos de ingreso" };
  }
  const fila = await airtable.obtener(L.idBase, L.idTabla, limpieza);
  const unidades = (fila?.fields[L.campos.unidad.id] as string[] | undefined) ?? [];
  if (!unidades.length) return { error: "La limpieza no tiene unidad" };
  const [u] = await airtable.porIds(U.idBase, U.idTabla, unidades.slice(0, 1));
  if (!u) return { error: "No se encontró la unidad" };
  await auditar(db, { autor: s.correo, accion: "ruta.codigo_abierto", idBase: U.idBase, idTabla: U.idTabla, recId: u.id, detalle: `limpieza ${limpieza}` });
  const c = U.campos;
  return {
    metodo: texto(u.fields[c.metodo.id]),
    codigo: texto(u.fields[c.codigo.id]),
    candado: texto(u.fields[c.candado.id]),
    wifiRed: texto(u.fields[c.wifiRed.id]),
    wifiClave: texto(u.fields[c.wifiClave.id]),
  };
}

export interface Reporte {
  limpieza: string;
  tipo: "Inventario de Entrega" | "Inventario de Recibido";
  estado: "Listo para entregar" | "Actividades pendientes";
  danos?: string;
  comentario?: string;
  necesitaImplementos: boolean;
  implementos?: string;
  lavanderia?: string;
  /** URL del video ya subido al almacenamiento de la app. */
  video?: { url: string; nombre: string };
}

/** Crea la fila de SERVICIOS con el reporte y, si queda lista, pasa la limpieza a Terminado. */
export async function reportar(db: Db, airtable: ClienteAirtable, s: Sesion, hoy: string, r: Reporte, ahora = new Date()): Promise<Resultado> {
  if (!puede(s, "verse", MODULO_RUTA, "editar")) return { ok: false, mensaje: "No tienes la Ruta de aseo" };
  const f = await funcionariaDe(airtable, s);
  if (!f) return { ok: false, mensaje: "Tu usuario no está en FUNCIONARIAS" };
  const parada = await paradaPropia(airtable, f, hoy, r.limpieza);
  if (!parada) return { ok: false, mensaje: "Esa limpieza no está en tu ruta de hoy" };
  if (parada.terminada) return { ok: false, mensaje: "Esa limpieza ya está terminada" };
  if (!(await turnoAbierto(airtable, f, hoy))) return { ok: false, mensaje: "Inicia el turno antes de reportar" };
  const fila = await airtable.obtener(L.idBase, L.idTabla, r.limpieza);
  const unidades = (fila?.fields[L.campos.unidad.id] as string[] | undefined) ?? [];

  const c = S.campos;
  const servicio = await escribir(db, airtable, s, {
    idBase: S.idBase,
    idTabla: S.idTabla,
    campos: {
      [c.unidad.id]: unidades.slice(0, 1),
      [c.tipo.id]: r.tipo,
      [c.fechaHora.id]: ahoraIso(ahora),
      [c.funcionaria.id]: [f.recId],
      ...(f.nombreServicios ? { [c.funcionario.id]: f.nombreServicios } : {}),
      [c.estado.id]: r.estado,
      [c.necesitaImplementos.id]: r.necesitaImplementos ? "Si" : "No",
      ...(r.danos?.trim() ? { [c.danos.id]: r.danos.trim() } : {}),
      ...(r.comentario?.trim() ? { [c.comentario.id]: r.comentario.trim() } : {}),
      ...(r.implementos?.trim() ? { [c.implementosComprar.id]: r.implementos.trim() } : {}),
      ...(r.lavanderia?.trim() ? { [c.lavanderia.id]: r.lavanderia.trim() } : {}),
      ...(r.video ? { [c.video.id]: [{ url: r.video.url, filename: r.video.nombre }] } : {}),
    },
  });
  if (!servicio.ok) return { ok: false, mensaje: "Airtable no aceptó el reporte. Intenta de nuevo" };
  await auditar(db, { autor: s.correo, accion: "ruta.reporte", idBase: S.idBase, idTabla: S.idTabla, recId: servicio.recId, detalle: `${parada.unidad} · ${r.estado}` });
  // Daños, implementos o pendientes abren tickets para que alguien los cierre.
  const tickets = await abrirTicketsDeReporte(
    db,
    airtable,
    s.correo,
    { unidad: parada.unidad, unidadRecId: unidades[0], servicioRecId: servicio.recId, estado: r.estado, danos: r.danos, necesitaImplementos: r.necesitaImplementos, implementos: r.implementos, comentario: r.comentario },
    hoy,
  );
  const conTickets = tickets ? ` · ${tickets === 1 ? "1 ticket abierto" : `${tickets} tickets abiertos`}` : "";

  if (r.estado === "Listo para entregar") {
    const fin = await escribir(db, airtable, s, { idBase: L.idBase, idTabla: L.idTabla, recId: r.limpieza, campos: { [L.campos.estado.id]: "Terminado" } });
    if (!fin.ok) return { ok: true, mensaje: `Reporte enviado${conTickets}. La limpieza no se pudo marcar Terminado: avísale a Diana` };
  }
  return { ok: true, mensaje: (r.estado === "Listo para entregar" ? `${parada.unidad} reportada y terminada` : `${parada.unidad} reportada con actividades pendientes`) + conTickets };
}

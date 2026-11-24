import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { diaAirtable, numeroDia } from "@/lib/airtable/formulas";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { puede, type Sesion } from "@/lib/acceso/permisos";
import { auditar } from "@/lib/auditoria";
import { isoBogota } from "@/lib/aseos/programacion";
import { leerFecha } from "@/lib/vistas/fechas";
import { sumarDias } from "@/lib/vistas/periodo";
import { FESTIVOS } from "./festivos";

/**
 * Control de horas de la semana (fase 1.4, plan aprobado por Felipe el 2026-11-24). Mismas
 * reglas que vh-control-horas: 42 h (7,5 de lunes a viernes, 4,5 el sábado, 0 el domingo y los
 * festivos) y 1 h de almuerzo si el turno pasa de 5 h. Coordinación cierra turnos olvidados
 * (Salida y una Nota) y valida la semana (Validado). No crea campos. El correo del lunes lo
 * sigue mandando vh-control-horas desde Claude.
 */

export const MODULO_EQUIPO = "verse-equipo";
const H = ESCRITURA.controlHoras;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const REC = /^rec[A-Za-z0-9]{14}$/;
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface TurnoSemana {
  recId: string;
  fecha: string;
  ingreso: string;
  salida: string;
  horas: number | null;
  validado: boolean;
}

export interface DiaSemana {
  fecha: string;
  nombre: string;
  programado: number;
  real: number;
  festivo: boolean;
}

export interface SemanaFuncionaria {
  nombre: string;
  dias: DiaSemana[];
  meta: number;
  real: number;
  diferencia: number;
  /** Turnos de días ya pasados sin Salida. */
  abiertos: TurnoSemana[];
  validada: boolean;
  turnos: TurnoSemana[];
}

const texto = (v: unknown): string => (v === null || v === undefined ? "" : Array.isArray(v) ? v.map(texto).filter(Boolean).join(", ") : String(v));
const minutos = (h: string) => {
  const m = h.match(/^(\d{1,2}):(\d{2}) ([ap])/);
  return m ? ((Number(m[1]) % 12) + (m[3] === "p" ? 12 : 0)) * 60 + Number(m[2]) : null;
};

/** Horas de un turno con la regla de la fórmula: menos 1 h de almuerzo si pasa de 5 h. */
export function horasTurno(ingreso: string, salida: string): number | null {
  const a = minutos(ingreso);
  const b = minutos(salida);
  if (a === null || b === null || b <= a) return null;
  const h = (b - a) / 60;
  return Math.round((h > 5 ? h - 1 : h) * 100) / 100;
}

export function programadoDe(fecha: string): number {
  if (FESTIVOS.has(fecha)) return 0;
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return d === 0 ? 0 : d === 6 ? 4.5 : 7.5;
}

/** "1,5" → "1 h 30 min". */
export function hMin(h: number): string {
  const total = Math.round(Math.abs(h) * 60);
  const [hh, mm] = [Math.floor(total / 60), total % 60];
  return hh && mm ? `${hh} h ${mm} min` : hh ? `${hh} h` : `${mm} min`;
}

export const puedeControlar = (s: Sesion) => puede(s, "verse", MODULO_EQUIPO, "editar");

/** Turnos de la semana [lunes, lunes+7) por funcionaria, con el cálculo de la semana. */
export async function semanaHoras(airtable: ClienteAirtable, lunes: string, hoy: string): Promise<SemanaFuncionaria[]> {
  const c = H.campos;
  const ingreso = diaAirtable(c.ingreso.nombre, "fechaHora");
  const filas = await airtable.consultar(H.idBase, H.idTabla, {
    campos: [c.funcionaria.nombre, c.funcionariaEnlace.nombre, c.ingreso.nombre, c.salida.nombre, c.validado.nombre],
    formula: `AND({${c.ingreso.nombre}}, ${ingreso} >= ${numeroDia(lunes)}, ${ingreso} < ${numeroDia(sumarDias(lunes, 7))})`,
    orden: { campo: c.ingreso.nombre, desc: false },
    max: 300,
  });
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const porPersona = new Map<string, TurnoSemana[]>();
  for (const r of filas) {
    const nombre = texto(r.fields[c.funcionariaEnlace.nombre]) || texto(r.fields[c.funcionaria.nombre]) || "Sin nombre";
    const i = leerFecha(texto(r.fields[c.ingreso.nombre]));
    const o = leerFecha(texto(r.fields[c.salida.nombre]));
    if (!i) continue;
    const t: TurnoSemana = {
      recId: r.id,
      fecha: i.fecha,
      ingreso: i.hora,
      salida: o?.hora ?? "",
      horas: o ? horasTurno(i.hora, o.hora) : null,
      validado: ["checked", "true", "1"].includes(texto(r.fields[c.validado.nombre]).toLowerCase()),
    };
    porPersona.set(nombre, [...(porPersona.get(nombre) ?? []), t]);
  }
  return [...porPersona.entries()]
    .map(([nombre, turnos]) => {
      const dias = fechas.map((f, k) => ({
        fecha: f,
        nombre: DIAS[k]!,
        programado: programadoDe(f),
        real: Math.round(turnos.filter((t) => t.fecha === f).reduce((n, t) => n + (t.horas ?? 0), 0) * 100) / 100,
        festivo: FESTIVOS.has(f),
      }));
      const meta = dias.reduce((n, d) => n + d.programado, 0);
      const real = Math.round(dias.reduce((n, d) => n + d.real, 0) * 100) / 100;
      return {
        nombre,
        dias,
        meta,
        real,
        diferencia: Math.round((real - meta) * 100) / 100,
        abiertos: turnos.filter((t) => !t.salida && t.fecha < hoy),
        validada: turnos.length > 0 && turnos.every((t) => t.validado),
        turnos,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

async function escribir(db: Db, airtable: ClienteAirtable, s: Sesion, recId: string, campos: Record<string, unknown>, esperado: Record<string, unknown>) {
  const id = await encolar(db, { idBase: H.idBase, idTabla: H.idTabla, recId, campos, esperado, autor: s.correo });
  await procesarCola(db, airtable);
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, id));
  return { estado: fila?.estado, error: fila?.error ?? "" };
}

export interface Resultado {
  ok: boolean;
  mensaje: string;
}

/** Cierra un turno olvidado con la hora que dice coordinación, el mismo día del ingreso. */
export async function cerrarOlvidado(db: Db, airtable: ClienteAirtable, s: Sesion, recId: string, hora: string): Promise<Resultado> {
  if (!puedeControlar(s)) return { ok: false, mensaje: "No puedes corregir turnos" };
  if (!REC.test(recId) || !HORA.test(hora)) return { ok: false, mensaje: "Datos inválidos" };
  const fila = await airtable.obtener(H.idBase, H.idTabla, recId);
  if (!fila) return { ok: false, mensaje: "El turno ya no existe en Airtable" };
  const c = H.campos;
  if (fila.fields[c.salida.id]) return { ok: false, mensaje: "Ese turno ya tiene salida" };
  const ingreso = new Date(String(fila.fields[c.ingreso.id] ?? ""));
  if (Number.isNaN(ingreso.getTime())) return { ok: false, mensaje: "El turno no tiene ingreso" };
  const dia = new Date(ingreso.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
  const salida = isoBogota(dia, hora);
  const duracion = (new Date(salida).getTime() - ingreso.getTime()) / 3_600_000;
  if (duracion <= 0) return { ok: false, mensaje: "La salida tiene que ser después del ingreso" };
  if (duracion > 14) return { ok: false, mensaje: "Un turno no puede pasar de 14 horas" };
  const nota = [texto(fila.fields[c.notas.id]), `Salida corregida por ${s.nombreAirtable ?? s.correo} desde Verse App`].filter(Boolean).join("\n");
  const r = await escribir(db, airtable, s, recId, { [c.salida.id]: salida, [c.notas.id]: nota }, { [c.salida.id]: null });
  if (r.estado !== "hecha" && r.estado !== "pendiente") return { ok: false, mensaje: r.error.includes("cambió") ? "El turno cambió en Airtable; recarga" : "Airtable no aceptó la salida" };
  await auditar(db, { autor: s.correo, accion: "horas.salida_corregida", idBase: H.idBase, idTabla: H.idTabla, recId, detalle: `${dia} ${hora}` });
  return { ok: true, mensaje: "Turno cerrado" };
}

/** Marca Validado en los turnos de la semana de una funcionaria. Con turnos abiertos no valida. */
export async function validarSemana(db: Db, airtable: ClienteAirtable, s: Sesion, nombre: string, lunes: string, hoy: string): Promise<Resultado> {
  if (!puedeControlar(s)) return { ok: false, mensaje: "No puedes validar horas" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lunes)) return { ok: false, mensaje: "Semana inválida" };
  const semana = (await semanaHoras(airtable, lunes, hoy)).find((x) => x.nombre === nombre);
  if (!semana) return { ok: false, mensaje: "No hay turnos de esa persona en la semana" };
  if (semana.turnos.some((t) => !t.salida)) return { ok: false, mensaje: "Hay turnos sin salida: ciérralos antes de validar" };
  const pendientes = semana.turnos.filter((t) => !t.validado);
  if (!pendientes.length) return { ok: true, mensaje: "La semana ya estaba validada" };
  let fallas = 0;
  for (const t of pendientes) {
    const r = await escribir(db, airtable, s, t.recId, { [H.campos.validado.id]: true }, {});
    if (r.estado !== "hecha" && r.estado !== "pendiente") fallas++;
  }
  await auditar(db, { autor: s.correo, accion: "horas.semana_validada", idBase: H.idBase, idTabla: H.idTabla, recId: null, detalle: `${nombre} · semana del ${lunes} · ${pendientes.length - fallas} turnos` });
  return fallas ? { ok: false, mensaje: `Se validaron ${pendientes.length - fallas} de ${pendientes.length} turnos. Intenta de nuevo` } : { ok: true, mensaje: `Semana de ${nombre} validada (${pendientes.length} turnos)` };
}

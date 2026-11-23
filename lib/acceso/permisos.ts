import type { Casillas, NivelModulo } from "./casillas";
import { ESTRUCTURA, type EmpresaBase } from "./estructura";

/**
 * Función única de permisos (regla 2 del CLAUDE.md). Toda consulta de la app pasa por aquí:
 * el acceso se decide en el servidor y lo no permitido no sale del servidor.
 */

export interface Sesion {
  usuarioId: string;
  correo: string;
  estado: "invitado" | "activo" | "suspendido";
  maestro: boolean;
  /** Nombre en Airtable (Responsable en TRAZABILIDAD, funcionaria en LIMPIEZA). */
  nombreAirtable: string | null;
  /** Casillas por empresa. Sin entrada = sin acceso a esa empresa. */
  accesos: Record<string, Casillas>;
  /** Estructura vigente (Postgres, editable en Ajustes). Sin ella se usa la de arranque. */
  estructura?: EmpresaBase[];
}

export class ErrorAcceso extends Error {
  override name = "ErrorAcceso";
}

const estructuraDe = (s: Sesion | null): EmpresaBase[] => s?.estructura ?? ESTRUCTURA;

function ubicacionDe(s: Sesion | null, modulo: string): { empresa: string; vertical: string } | undefined {
  for (const e of estructuraDe(s)) for (const v of e.verticales) if (v.modulos.some((m) => m.id === modulo)) return { empresa: e.id, vertical: v.id };
  return undefined;
}

const activa = (s: Sesion | null): s is Sesion => Boolean(s && s.estado === "activo");

/** Empresas que la persona puede abrir. */
export function empresasVisibles(s: Sesion | null): string[] {
  if (!activa(s)) return [];
  const ids = estructuraDe(s).map((e) => e.id);
  if (s.maestro) return ids;
  return ids.filter((id) => {
    const c = s.accesos[id];
    return c && Object.values(c.modulos).some((n) => n !== "sin");
  });
}

/** Nivel en un módulo. El módulo debe pertenecer a la empresa pedida. */
export function nivel(s: Sesion | null, empresa: string, modulo: string): NivelModulo {
  const ubicacion = ubicacionDe(s, modulo);
  if (!activa(s) || !ubicacion || ubicacion.empresa !== empresa) return "sin";
  if (s.maestro) return "editar";
  return s.accesos[empresa]?.modulos[modulo] ?? "sin";
}

export function puede(s: Sesion | null, empresa: string, modulo: string, accion: "ver" | "editar"): boolean {
  const n = nivel(s, empresa, modulo);
  return accion === "ver" ? n !== "sin" : n === "editar";
}

/** Para rutas y acciones del servidor: corta con ErrorAcceso si no hay permiso. */
export function exigir(s: Sesion | null, empresa: string, modulo: string, accion: "ver" | "editar"): Sesion {
  if (!puede(s, empresa, modulo, accion)) throw new ErrorAcceso(`Sin permiso para ${accion} ${modulo}`);
  return s as Sesion;
}

export function modulosVisibles(s: Sesion | null, empresa: string): string[] {
  const e = estructuraDe(s).find((x) => x.id === empresa);
  if (!e) return [];
  return e.verticales.flatMap((v) => v.modulos.map((m) => m.id)).filter((m) => puede(s, empresa, m, "ver"));
}

export function alcanceHoy(s: Sesion | null, empresa: string): "todo" | "suyo" | null {
  if (!activa(s)) return null;
  if (s.maestro) return "todo";
  return s.accesos[empresa] ? s.accesos[empresa].alcanceHoy : null;
}

export function puedeAprobar(s: Sesion | null, empresa: string): boolean {
  return activa(s) && (s.maestro || Boolean(s.accesos[empresa]?.aprobar));
}

export function nivelCorreo(s: Sesion | null, empresa: string, cuenta: string): "sin" | "leer" | "redactar" | "enviar" {
  if (!activa(s)) return "sin";
  const e = estructuraDe(s).find((x) => x.id === empresa);
  if (!e?.cuentas.some((c) => c.id === cuenta)) return "sin";
  if (s.maestro) return "enviar";
  return s.accesos[empresa]?.correo[cuenta] ?? "sin";
}

export interface Sensibles {
  cifras: boolean;
  terceros: boolean;
  codigos: "nunca" | "turno" | "siempre";
}

export function sensibles(s: Sesion | null, empresa: string, vertical: string): Sensibles {
  if (!activa(s)) return { cifras: false, terceros: false, codigos: "nunca" };
  if (s.maestro) return { cifras: true, terceros: true, codigos: "siempre" };
  const c = s.accesos[empresa];
  return {
    cifras: Boolean(c?.cifras[vertical]),
    terceros: Boolean(c?.terceros[vertical]),
    codigos: c?.codigos[vertical] ?? "nunca",
  };
}

export interface ReglasLimpieza<T> {
  cifras?: (keyof T)[];
  terceros?: (keyof T)[];
  codigos?: (keyof T)[];
  /** Para "Solo en su turno": si esta fila está dentro del turno de la persona. */
  enTurno?: (fila: T) => boolean;
}

/**
 * Quita de cada fila lo que la persona no puede ver, antes de responder.
 * Los campos se eliminan del objeto: no viajan ocultos a la pantalla.
 */
export function limpiar<T extends Record<string, unknown>>(filas: T[], sens: Sensibles, reglas: ReglasLimpieza<T>): Partial<T>[] {
  return filas.map((fila) => {
    const copia: Partial<T> = { ...fila };
    if (!sens.cifras) for (const k of reglas.cifras ?? []) delete copia[k];
    if (!sens.terceros) for (const k of reglas.terceros ?? []) delete copia[k];
    const verCodigos = sens.codigos === "siempre" || (sens.codigos === "turno" && Boolean(reglas.enTurno?.(fila)));
    if (!verCodigos) for (const k of reglas.codigos ?? []) delete copia[k];
    return copia;
  });
}

/** Para Hoy con alcance "suyo": solo filas donde Responsable es la persona. */
export function filtrarSuyo<T extends { responsable?: string | null }>(filas: T[], s: Sesion | null, empresa: string): T[] {
  const alcance = alcanceHoy(s, empresa);
  if (alcance === "todo") return filas;
  if (alcance === null || !s?.nombreAirtable) return [];
  return filas.filter((f) => f.responsable === s.nombreAirtable);
}

import { diaAirtable, numeroDia } from "@/lib/airtable/formulas";
/**
 * Período de una vista. Toda pantalla abre en lo actual (hoy, esta semana o este mes) y se
 * mueve con ‹ ›. El período vive en la URL (?p=…) para poder compartir el enlace:
 *   día    2026-11-23
 *   semana 2026-W48 (lunes a domingo, ISO)
 *   mes    2026-11
 * Las fechas son de Bogotá (AAAA-MM-DD) y `fin` es exclusivo.
 */

/** "continuo": una ventana fija alrededor de hoy (dos semanas atrás, cuatro meses adelante), sin flechas: el calendario de reservas se recorre con scroll. */
export type UnidadPeriodo = "dia" | "semana" | "mes" | "continuo";

export interface Periodo {
  unidad: UnidadPeriodo;
  /** Valor para ?p= */
  clave: string;
  inicio: string;
  fin: string;
  etiqueta: string;
  anterior: string;
  siguiente: string;
  /** Contiene hoy. */
  actual: boolean;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const aFecha = (t: string) => new Date(`${t}T12:00:00Z`);
const aTexto = (d: Date) => d.toISOString().slice(0, 10);
export const sumarDias = (t: string, n: number) => {
  const d = aFecha(t);
  d.setUTCDate(d.getUTCDate() + n);
  return aTexto(d);
};
const lunesDe = (t: string) => {
  const d = aFecha(t);
  return sumarDias(t, -((d.getUTCDay() + 6) % 7));
};

/** Semana ISO de una fecha: año y número. */
function semanaIso(t: string): { anio: number; semana: number } {
  const jueves = aFecha(sumarDias(lunesDe(t), 3));
  const anio = jueves.getUTCFullYear();
  const primero = aFecha(`${anio}-01-04`);
  const lunes1 = sumarDias(aTexto(primero), -((primero.getUTCDay() + 6) % 7));
  return { anio, semana: Math.floor((aFecha(lunesDe(t)).getTime() - aFecha(lunes1).getTime()) / (7 * 86_400_000)) + 1 };
}

function lunesDeSemanaIso(anio: number, semana: number): string {
  const enero4 = aFecha(`${anio}-01-04`);
  const lunes1 = sumarDias(aTexto(enero4), -((enero4.getUTCDay() + 6) % 7));
  return sumarDias(lunes1, (semana - 1) * 7);
}

const claveSemana = (t: string) => {
  const { anio, semana } = semanaIso(t);
  return `${anio}-W${String(semana).padStart(2, "0")}`;
};

/** Construye el período que contiene `fecha`. */
export function periodoDe(unidad: UnidadPeriodo, fecha: string, hoy: string): Periodo {
  if (unidad === "continuo") {
    const inicio = sumarDias(hoy, -14);
    const fin = sumarDias(hoy, 120);
    return { unidad, clave: "", inicio, fin, etiqueta: "De hace dos semanas a cuatro meses", anterior: "", siguiente: "", actual: true };
  }
  if (unidad === "dia") {
    const d = aFecha(fecha);
    return {
      unidad,
      clave: fecha,
      inicio: fecha,
      fin: sumarDias(fecha, 1),
      etiqueta: `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`,
      anterior: sumarDias(fecha, -1),
      siguiente: sumarDias(fecha, 1),
      actual: fecha === hoy,
    };
  }
  if (unidad === "semana") {
    const inicio = lunesDe(fecha);
    const fin = sumarDias(inicio, 7);
    const a = aFecha(inicio);
    const b = aFecha(sumarDias(inicio, 6));
    const etiqueta =
      a.getUTCMonth() === b.getUTCMonth()
        ? `${a.getUTCDate()} al ${b.getUTCDate()} de ${MESES[b.getUTCMonth()]}`
        : `${a.getUTCDate()} ${MESES_CORTOS[a.getUTCMonth()]} al ${b.getUTCDate()} ${MESES_CORTOS[b.getUTCMonth()]}`;
    return { unidad, clave: claveSemana(inicio), inicio, fin, etiqueta, anterior: claveSemana(sumarDias(inicio, -7)), siguiente: claveSemana(fin), actual: hoy >= inicio && hoy < fin };
  }
  const [a, m] = fecha.split("-").map(Number) as [number, number];
  const inicio = `${a}-${String(m).padStart(2, "0")}-01`;
  const sig = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  const ant = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
  return { unidad, clave: inicio.slice(0, 7), inicio, fin: sig, etiqueta: `${MESES[m - 1]} ${a}`, anterior: ant, siguiente: sig.slice(0, 7), actual: hoy >= inicio && hoy < sig };
}

/** Lee ?p= según la unidad del módulo; si falta o no es válido, el período actual. */
/** "2026-11-25" → "2026-10": el mes anterior, para módulos que abren en el último mes cerrado. */
export function mesAnterior(hoy: string): string {
  const [a, m] = hoy.split("-").map(Number) as [number, number];
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/** Período pedido en la URL o, si no hay, el inicial del módulo (actual o el mes anterior). */
export function periodoInicial(def: { unidad: UnidadPeriodo; inicio?: "anterior" }, p: string | undefined, hoy: string): Periodo {
  return leerPeriodo(def.unidad, p ?? (def.inicio === "anterior" && def.unidad === "mes" ? mesAnterior(hoy) : undefined), hoy);
}

export function leerPeriodo(unidad: UnidadPeriodo, p: string | undefined, hoy: string): Periodo {
  const v = (p ?? "").trim();
  if (unidad === "dia" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(aFecha(v).getTime())) return periodoDe("dia", v, hoy);
  if (unidad === "semana") {
    const s = v.match(/^(\d{4})-W(\d{2})$/);
    if (s && Number(s[2]) >= 1 && Number(s[2]) <= 53) return periodoDe("semana", lunesDeSemanaIso(Number(s[1]), Number(s[2])), hoy);
  }
  if (unidad === "mes" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return periodoDe("mes", `${v}-01`, hoy);
  return periodoDe(unidad, hoy, hoy);
}

const num = numeroDia;
/** El día del campo como número AAAAMMDD (ver diaAirtable: los campos de solo fecha no se corren). */
const diaDe = (campo: string) => diaAirtable(campo);

/** Fórmula de Airtable: la fecha del campo cae dentro del período (en hora de Bogotá). */
export function formulaDentro(campo: string, p: Pick<Periodo, "inicio" | "fin">): string {
  return `AND({${campo}}, ${diaDe(campo)} >= ${num(p.inicio)}, ${diaDe(campo)} < ${num(p.fin)})`;
}

/** Fórmula de Airtable: un rango [inicio, fin] del registro se cruza con el período (reservas, contratos). */
export function formulaCruza(campoInicio: string, campoFin: string, p: Pick<Periodo, "inicio" | "fin">, finEsSalida = false): string {
  // Con finEsSalida (reservas), el último día es el de salida: no es una noche, así que una reserva que sale el 1 no cuenta en ese mes.
  return `AND({${campoInicio}}, ${diaDe(campoInicio)} < ${num(p.fin)}, OR({${campoFin}} = BLANK(), ${diaDe(campoFin)} ${finEsSalida ? ">" : ">="} ${num(p.inicio)}))`;
}

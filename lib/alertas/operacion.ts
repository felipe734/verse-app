import { diaAirtable, numeroDia, type TipoFecha } from "@/lib/airtable/formulas";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import type { EmpresaBase } from "@/lib/acceso/estructura";
import { puede, type Sesion } from "@/lib/acceso/permisos";
import { REGISTRO, segmentoVertical } from "@/lib/modulos/registro";
import { leerFecha } from "@/lib/vistas/fechas";
import { sumarDias } from "@/lib/vistas/periodo";
import { ids } from "@/lib/modulos/tablas-equipo";
import type { Db } from "@/db/cliente";
import { COPIAS_ALERTAS, copiaLista, filasPorFecha, igual, nombresLiving, nombresOperacion, vacio, valor, vinculo } from "@/lib/copias/leer";

/**
 * Alertas de la operación: lo que se cae entre las sillas y hoy solo aparece en los briefs.
 * Se calculan con lecturas de Airtable (con la caché de 60 s) y solo para los módulos que la
 * persona ve. No traen montos: cuentan y nombran.
 */
export interface Alerta {
  id: string;
  /** Tipo del módulo donde se resuelve. */
  modulo: string;
  nivel: "alta" | "media";
  titulo: string;
  detalle: string;
  cuenta: number;
  href: string;
}

const dia = (campo: string, tipo?: TipoFecha) => diaAirtable(campo, tipo);
const num = numeroDia;
const texto = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v));
const lista = (xs: string[], n = 4) => (xs.length > n ? `${xs.slice(0, n).join(", ")} y ${xs.length - n} más` : xs.join(", "));

interface Contexto {
  airtable: ClienteAirtable;
  s: Sesion;
  estructura: EmpresaBase[];
  hoy: string;
  /** Con la base, las alertas de reservas, limpiezas y cobros se leen de la copia si está lista. */
  db?: Db;
  /** Se calcula una vez en alertasDe. */
  copia?: boolean;
}

/** Ruta del módulo de un tipo, si la persona lo ve. */
export function rutaModulo(s: Sesion, estructura: EmpresaBase[], empresa: string, tipo: string, consulta = ""): string | null {
  const e = estructura.find((x) => x.id === empresa);
  const def = REGISTRO.find((d) => d.tipo === tipo);
  const l = e?.verticales.flatMap((v) => v.modulos.map((m) => ({ v, m }))).find((x) => x.m.tipo === tipo);
  if (!e || !def || !l || !puede(s, empresa, l.m.id, "ver")) return null;
  return `/${empresa}/${segmentoVertical(empresa, l.v.id)}/${def.segmento}${consulta}`;
}

const lugar = (c: Contexto, empresa: string, tipo: string, consulta = "") => rutaModulo(c.s, c.estructura, empresa, tipo, consulta);

/** Salidas de los próximos 3 días sin limpieza programada para esa unidad en esa fecha. */
async function reservasSinLimpieza(c: Contexto): Promise<Alerta | null> {
  const href = lugar(c, "verse", "limpiezas", "?programar=1");
  if (!href || !lugar(c, "verse", "operacion")) return null;
  if (c.copia && c.db) {
    const [salidas, limpiezas] = await Promise.all([
      filasPorFecha(c.db, "reservasHost", "salida", { desde: c.hoy, hasta: sumarDias(c.hoy, 4) }),
      filasPorFecha(c.db, "limpiezasHost", "fecha", { desde: c.hoy, hasta: sumarDias(c.hoy, 5) }),
    ]);
    const hechas = new Set(limpiezas.flatMap((l) => vinculo(valor(l, "limpiezasHost", "unidad")).map((u) => `${u}|${l.dia}`)));
    const faltan = salidas.flatMap((r) => vinculo(valor(r, "reservasHost", "unidad")).filter((u) => !hechas.has(`${u}|${r.dia}`)).map((u) => ({ u, fecha: r.dia })));
    const nombres = await nombresOperacion(c.db, faltan.map((f) => f.u));
    return armarSinLimpieza(faltan.map((f) => ({ unidad: nombres.get(f.u) || "Unidad", fecha: f.fecha })), href);
  }
  const R = ids("6. OPERACION 360", "RESERVAS");
  const L = ids("6. OPERACION 360", "LIMPIEZA");
  const desde = num(c.hoy);
  const hasta = num(sumarDias(c.hoy, 3));
  const [salidas, limpiezas] = await Promise.all([
    c.airtable.consultar(R.idBase, R.idTabla, { campos: ["Unidad", "Salida"], formula: `AND({Salida}, ${dia("Salida", "fecha")} >= ${desde}, ${dia("Salida", "fecha")} <= ${hasta})`, max: 100 }),
    c.airtable.consultar(L.idBase, L.idTabla, { campos: ["Unidad", "Fecha"], formula: `AND({Fecha}, ${dia("Fecha", "fechaHora")} >= ${desde}, ${dia("Fecha", "fechaHora")} <= ${num(sumarDias(c.hoy, 4))})`, max: 200 }),
  ]);
  const hechas = new Set(limpiezas.map((l) => `${texto(l.fields["Unidad"])}|${leerFecha(texto(l.fields["Fecha"]))?.fecha}`));
  const faltan = salidas
    .map((r) => ({ unidad: texto(r.fields["Unidad"]), fecha: leerFecha(texto(r.fields["Salida"]))?.fecha }))
    .filter((r) => r.unidad && r.fecha && !hechas.has(`${r.unidad}|${r.fecha}`));
  return armarSinLimpieza(faltan as { unidad: string; fecha: string }[], href);
}

function armarSinLimpieza(faltan: { unidad: string; fecha: string }[], href: string): Alerta | null {
  if (!faltan.length) return null;
  return {
    id: "reservas-sin-limpieza",
    modulo: "limpiezas",
    nivel: "alta",
    titulo: faltan.length === 1 ? "1 salida sin limpieza" : `${faltan.length} salidas sin limpieza`,
    detalle: `En los próximos 3 días: ${lista(faltan.map((f) => `${f.unidad} (${Number(f.fecha.slice(8))})`))}`,
    cuenta: faltan.length,
    href,
  };
}

/** Limpiezas de los próximos 7 días sin funcionaria. */
async function limpiezasSinFuncionaria(c: Contexto): Promise<Alerta | null> {
  const href = lugar(c, "verse", "limpiezas", "?v=lista&quien=todo&f.Funcionario=(vac%C3%ADo)");
  if (!href) return null;
  let unidadesSin: string[];
  if (c.copia && c.db) {
    const filas = await filasPorFecha(c.db, "limpiezasHost", "fecha", { desde: c.hoy, hasta: sumarDias(c.hoy, 8) }, [vacio("limpiezasHost", "funcionario")]);
    const ids_ = filas.map((f) => vinculo(valor(f, "limpiezasHost", "unidad"))[0] ?? "");
    const nombres = await nombresOperacion(c.db, ids_.filter(Boolean));
    unidadesSin = ids_.map((u) => nombres.get(u) || "Unidad");
  } else {
    const L = ids("6. OPERACION 360", "LIMPIEZA");
    const filas = await c.airtable.consultar(L.idBase, L.idTabla, {
      campos: ["Unidad", "Fecha"],
      formula: `AND({Fecha}, {Funcionario} = BLANK(), ${dia("Fecha", "fechaHora")} >= ${num(c.hoy)}, ${dia("Fecha", "fechaHora")} <= ${num(sumarDias(c.hoy, 7))})`,
      max: 50,
    });
    unidadesSin = filas.map((f) => texto(f.fields["Unidad"]));
  }
  if (!unidadesSin.length) return null;
  return {
    id: "limpiezas-sin-funcionaria",
    modulo: "limpiezas",
    nivel: "alta",
    titulo: unidadesSin.length === 1 ? "1 limpieza sin funcionaria" : `${unidadesSin.length} limpiezas sin funcionaria`,
    detalle: `Esta semana: ${lista(unidadesSin)}`,
    cuenta: unidadesSin.length,
    href,
  };
}

/** Cánones POR PAGAR con fecha ya pasada. */
async function cobrosVencidos(c: Contexto): Promise<Alerta | null> {
  const href = lugar(c, "verse", "cobros", "?v=lista&f.Estado=POR%20PAGAR");
  if (!href) return null;
  let vencidos: string[];
  if (c.copia && c.db) {
    const filas = await filasPorFecha(c.db, "ingresosLivingCopia", "fecha", { hasta: c.hoy }, [igual("ingresosLivingCopia", "estado", "POR PAGAR")]);
    // En INGRESOS "Unidad" es texto; si algún día pasa a vínculo, se resuelve con las unidades de Living.
    const crudos = filas.map((f) => valor(f, "ingresosLivingCopia", "unidad"));
    const nombres = await nombresLiving(c.db, crudos.flatMap(vinculo));
    vencidos = crudos.map((v) => (typeof v === "string" ? v : nombres.get(vinculo(v)[0] ?? "")) || "Unidad");
  } else {
    const I = ids("7. LIVING", "INGRESOS");
    const filas = await c.airtable.consultar(I.idBase, I.idTabla, { campos: ["Unidad"], formula: `AND({Estado} = 'POR PAGAR', {Fecha}, ${dia("Fecha")} < ${num(c.hoy)})`, max: 50 });
    vencidos = filas.map((f) => texto(f.fields["Unidad"]));
  }
  if (!vencidos.length) return null;
  return {
    id: "cobros-vencidos",
    modulo: "cobros",
    nivel: "alta",
    titulo: vencidos.length === 1 ? "1 cobro vencido" : `${vencidos.length} cobros vencidos`,
    detalle: lista(vencidos),
    cuenta: vencidos.length,
    href,
  };
}

/** Contratos que terminan en los próximos 30 días. */
async function contratosPorTerminar(c: Contexto): Promise<Alerta | null> {
  const href = lugar(c, "verse", "contratos");
  if (!href) return null;
  const K = ids("7. LIVING", "CONTRATO");
  const filas = await c.airtable.consultar(K.idBase, K.idTabla, {
    campos: ["Unidad", "Fecha_Finalización"],
    formula: `AND({Fecha_Finalización}, ${dia("Fecha_Finalización")} >= ${num(c.hoy)}, ${dia("Fecha_Finalización")} <= ${num(sumarDias(c.hoy, 30))})`,
    max: 50,
  });
  if (!filas.length) return null;
  return {
    id: "contratos-por-terminar",
    modulo: "contratos",
    nivel: "media",
    titulo: filas.length === 1 ? "1 contrato termina este mes" : `${filas.length} contratos terminan en 30 días`,
    detalle: lista(filas.map((f) => `${texto(f.fields["Unidad"])} (${texto(f.fields["Fecha_Finalización"])})`)),
    cuenta: filas.length,
    href,
  };
}

/** Movimientos bancarios del mes sin identificar o sin soporte. */
async function movimientosSinSoporte(c: Contexto): Promise<Alerta | null> {
  const href = lugar(c, "verse", "finanzas", "?pestana=movimientos&v=lista");
  if (!href) return null;
  const M = ids("1. VL PRIVADO", "MOVIMIENTOS");
  const filas = await c.airtable.consultar(M.idBase, M.idTabla, {
    campos: ["Movimiento"],
    formula: `AND(OR({Estado} = 'Por identificar', {Estado} = 'Sin soporte'), {Fecha}, ${dia("Fecha")} >= ${num(sumarDias(c.hoy, -45))})`,
    max: 100,
  });
  if (!filas.length) return null;
  return {
    id: "movimientos-sin-soporte",
    modulo: "finanzas",
    nivel: "media",
    titulo: filas.length === 1 ? "1 movimiento sin soporte" : `${filas.length} movimientos sin soporte`,
    detalle: "Últimos 45 días, por identificar o sin soporte",
    cuenta: filas.length,
    href,
  };
}

const REGLAS: { modulo: string; f: (c: Contexto) => Promise<Alerta | null> }[] = [
  { modulo: "limpiezas", f: reservasSinLimpieza },
  { modulo: "limpiezas", f: limpiezasSinFuncionaria },
  { modulo: "cobros", f: cobrosVencidos },
  { modulo: "contratos", f: contratosPorTerminar },
  { modulo: "finanzas", f: movimientosSinSoporte },
];

/** Todas las alertas, o solo las de un módulo (sin consultar las demás). */
export async function alertasDe(c: Contexto, modulo?: string): Promise<Alerta[]> {
  if (c.db && c.copia === undefined) c = { ...c, copia: await copiaLista(c.db, [...COPIAS_ALERTAS, "unidadesLiving"]).catch(() => false) };
  const todas = await Promise.all(
    REGLAS.filter((r) => !modulo || r.modulo === modulo).map(({ f }) =>
      f(c).catch((e) => {
        console.error("[alertas]", f.name, e instanceof Error ? e.message : e);
        return null;
      }),
    ),
  );
  return todas.filter((a): a is Alerta => Boolean(a)).sort((a, b) => (a.nivel === b.nivel ? b.cuenta - a.cuenta : a.nivel === "alta" ? -1 : 1));
}

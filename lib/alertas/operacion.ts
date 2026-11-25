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

/**
 * Limpiezas de los próximos 7 días sin funcionaria. Las de hoy y mañana (menos de 24 h para
 * conseguir aseadora) van en rojo y aparte; las del resto de la semana, como aviso.
 */
async function limpiezasSinFuncionaria(c: Contexto): Promise<Alerta[]> {
  const href = lugar(c, "verse", "limpiezas", "?programar=1");
  if (!href) return [];
  let sin: { unidad: string; fecha: string }[];
  if (c.copia && c.db) {
    const filas = await filasPorFecha(c.db, "limpiezasHost", "fecha", { desde: c.hoy, hasta: sumarDias(c.hoy, 8) }, [vacio("limpiezasHost", "funcionario")]);
    const ids_ = filas.map((f) => vinculo(valor(f, "limpiezasHost", "unidad"))[0] ?? "");
    const nombres = await nombresOperacion(c.db, ids_.filter(Boolean));
    sin = filas.map((f, i) => ({ unidad: nombres.get(ids_[i]!) || "Unidad", fecha: f.dia }));
  } else {
    const L = ids("6. OPERACION 360", "LIMPIEZA");
    const filas = await c.airtable.consultar(L.idBase, L.idTabla, {
      campos: ["Unidad", "Fecha"],
      formula: `AND({Fecha}, {Funcionario} = BLANK(), ${dia("Fecha", "fechaHora")} >= ${num(c.hoy)}, ${dia("Fecha", "fechaHora")} <= ${num(sumarDias(c.hoy, 7))})`,
      max: 50,
    });
    sin = filas.map((f) => ({ unidad: texto(f.fields["Unidad"]), fecha: leerFecha(texto(f.fields["Fecha"]))?.fecha ?? "" }));
  }
  const manana = sumarDias(c.hoy, 1);
  const urgentes = sin.filter((x) => x.fecha && x.fecha <= manana);
  const semana = sin.filter((x) => !(x.fecha && x.fecha <= manana));
  const r: Alerta[] = [];
  if (urgentes.length)
    r.push({
      id: "limpiezas-sin-funcionaria-24h",
      modulo: "limpiezas",
      nivel: "alta",
      titulo: urgentes.length === 1 ? "1 aseo sin aseadora en menos de 24 h" : `${urgentes.length} aseos sin aseadora en menos de 24 h`,
      detalle: `Hoy y mañana: ${lista(urgentes.map((x) => x.unidad))}`,
      cuenta: urgentes.length,
      href,
    });
  if (semana.length)
    r.push({
      id: "limpiezas-sin-funcionaria",
      modulo: "limpiezas",
      nivel: "media",
      titulo: semana.length === 1 ? "1 aseo de la semana sin aseadora" : `${semana.length} aseos de la semana sin aseadora`,
      detalle: lista(semana.map((x) => x.unidad)),
      cuenta: semana.length,
      href,
    });
  return r;
}

/** Leads de Host que siguen en "Lead" (sin contactar) más de 48 horas después de llegar. Últimos 30 días. */
async function leadsSinContacto(c: Contexto): Promise<Alerta | null> {
  const href = lugar(c, "verse", "comercial-host", "?v=lista&f.Estado=Lead");
  if (!href) return null;
  const T = ids("10. LEAD GEN", "LEADS");
  const filas = await c.airtable.consultar(T.idBase, T.idTabla, {
    campos: ["Nombre"],
    formula: `AND(OR({Estado} = 'Lead', {Estado} = BLANK()), IS_BEFORE({Fecha de Envio}, DATEADD(NOW(), -48, 'hours')), IS_AFTER({Fecha de Envio}, DATEADD(NOW(), -30, 'days')))`,
    max: 50,
  });
  if (!filas.length) return null;
  return {
    id: "leads-sin-contacto",
    modulo: "comercial-host",
    nivel: "alta",
    titulo: filas.length === 1 ? "1 lead sin contactar hace más de 48 h" : `${filas.length} leads sin contactar hace más de 48 h`,
    detalle: lista(filas.map((f) => texto(f.fields["Nombre"]) || "Sin nombre")),
    cuenta: filas.length,
    href,
  };
}

/** Leads de Living (web) en "Nuevo" o sin estado más de 48 horas después de llegar. Últimos 30 días. */
async function leadsLivingSinContacto(c: Contexto): Promise<Alerta | null> {
  const href = lugar(c, "verse", "comercial-living", "?v=lista&f.Estado=Nuevo");
  if (!href) return null;
  const T = ids("7. LIVING", "WEB LEADS");
  const filas = await c.airtable.consultar(T.idBase, T.idTabla, {
    campos: ["Nombre"],
    formula: `AND(OR({Estado} = 'Nuevo', {Estado} = BLANK()), IS_BEFORE({Fecha}, DATEADD(NOW(), -48, 'hours')), IS_AFTER({Fecha}, DATEADD(NOW(), -30, 'days')))`,
    max: 50,
  });
  if (!filas.length) return null;
  return {
    id: "leads-living-sin-contacto",
    modulo: "comercial-living",
    nivel: "alta",
    titulo: filas.length === 1 ? "1 lead de Living sin contactar hace más de 48 h" : `${filas.length} leads de Living sin contactar hace más de 48 h`,
    detalle: lista(filas.map((f) => texto(f.fields["Nombre"]) || "Sin nombre")),
    cuenta: filas.length,
    href,
  };
}

/** Cánones POR PAGAR con fecha ya pasada: más de 5 días de atraso en rojo, el resto como aviso. */
async function cobrosVencidos(c: Contexto): Promise<Alerta[]> {
  const href = lugar(c, "verse", "cobros", "?v=lista&f.Estado=POR%20PAGAR");
  if (!href) return [];
  let vencidos: { unidad: string; fecha: string }[];
  if (c.copia && c.db) {
    const filas = await filasPorFecha(c.db, "ingresosLivingCopia", "fecha", { hasta: c.hoy }, [igual("ingresosLivingCopia", "estado", "POR PAGAR")]);
    // En INGRESOS "Unidad" es texto; si algún día pasa a vínculo, se resuelve con las unidades de Living.
    const crudos = filas.map((f) => valor(f, "ingresosLivingCopia", "unidad"));
    const nombres = await nombresLiving(c.db, crudos.flatMap(vinculo));
    vencidos = crudos.map((v, i) => ({ unidad: (typeof v === "string" ? v : nombres.get(vinculo(v)[0] ?? "")) || "Unidad", fecha: filas[i]!.dia }));
  } else {
    const I = ids("7. LIVING", "INGRESOS");
    const filas = await c.airtable.consultar(I.idBase, I.idTabla, { campos: ["Unidad", "Fecha"], formula: `AND({Estado} = 'POR PAGAR', {Fecha}, ${dia("Fecha")} < ${num(c.hoy)})`, max: 50 });
    vencidos = filas.map((f) => ({ unidad: texto(f.fields["Unidad"]), fecha: leerFecha(texto(f.fields["Fecha"]))?.fecha ?? "" }));
  }
  const limite = sumarDias(c.hoy, -5);
  const graves = vencidos.filter((v) => v.fecha && v.fecha < limite);
  const recientes = vencidos.filter((v) => !(v.fecha && v.fecha < limite));
  const r: Alerta[] = [];
  if (graves.length)
    r.push({
      id: "cobros-vencidos-5d",
      modulo: "cobros",
      nivel: "alta",
      titulo: graves.length === 1 ? "1 arriendo vencido hace más de 5 días" : `${graves.length} arriendos vencidos hace más de 5 días`,
      detalle: lista(graves.map((v) => v.unidad)),
      cuenta: graves.length,
      href,
    });
  if (recientes.length)
    r.push({
      id: "cobros-vencidos",
      modulo: "cobros",
      nivel: "media",
      titulo: recientes.length === 1 ? "1 cobro vencido esta semana" : `${recientes.length} cobros vencidos esta semana`,
      detalle: lista(recientes.map((v) => v.unidad)),
      cuenta: recientes.length,
      href,
    });
  return r;
}

/** Tickets abiertos o en curso con la fecha límite ya pasada. */
async function ticketsVencidos(c: Contexto): Promise<Alerta | null> {
  const href = lugar(c, "verse", "tickets", "?v=lista");
  if (!href) return null;
  const T = ids("6. OPERACION 360", "TICKETS");
  const filas = await c.airtable.consultar(T.idBase, T.idTabla, {
    campos: ["Título", "Unidad"],
    formula: `AND({Estado} != 'Cerrado', {Fecha límite}, ${dia("Fecha límite", "fecha")} < ${num(c.hoy)})`,
    max: 50,
  });
  if (!filas.length) return null;
  return {
    id: "tickets-vencidos",
    modulo: "tickets",
    nivel: "alta",
    titulo: filas.length === 1 ? "1 ticket vencido" : `${filas.length} tickets vencidos`,
    detalle: lista(filas.map((f) => texto(f.fields["Título"]))),
    cuenta: filas.length,
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

/**
 * Contratos de Living sin decisión de renovación (fase 2.5): unidad en Actual con Fecha Salida
 * en los próximos 90 días y Renovación vacía o Pendiente. A 60 días o menos, en rojo: el preaviso
 * de vivienda es de 90 días y la decisión tiene que estar antes.
 */
async function renovacionesSinDecidir(c: Contexto): Promise<Alerta[]> {
  const href = lugar(c, "verse", "unidades-living", "?v=lista&f.Estado=Actual");
  if (!href) return [];
  const U = ids("7. LIVING", "UNIDADES");
  const filas = await c.airtable.consultar(U.idBase, U.idTabla, {
    campos: ["Unidad", "Fecha Salida"],
    formula: `AND({Estado} = 'Actual', OR({Renovación} = BLANK(), {Renovación} = 'Pendiente'), {Fecha Salida}, ${dia("Fecha Salida")} >= ${num(c.hoy)}, ${dia("Fecha Salida")} <= ${num(sumarDias(c.hoy, 90))})`,
    max: 50,
    orden: { campo: "Fecha Salida" },
  });
  const salidas = filas.map((f) => ({ unidad: texto(f.fields["Unidad"]), fecha: leerFecha(texto(f.fields["Fecha Salida"]))?.fecha ?? "", txt: texto(f.fields["Fecha Salida"]) }));
  const limite = sumarDias(c.hoy, 60);
  const urgentes = salidas.filter((x) => x.fecha && x.fecha <= limite);
  const proximas = salidas.filter((x) => !(x.fecha && x.fecha <= limite));
  const r: Alerta[] = [];
  if (urgentes.length)
    r.push({
      id: "renovaciones-60d",
      modulo: "unidades-living",
      nivel: "alta",
      titulo: urgentes.length === 1 ? "1 contrato vence en 60 días sin decidir renovación" : `${urgentes.length} contratos vencen en 60 días sin decidir renovación`,
      detalle: lista(urgentes.map((x) => `${x.unidad} (${x.txt})`)),
      cuenta: urgentes.length,
      href,
    });
  if (proximas.length)
    r.push({
      id: "renovaciones-90d",
      modulo: "unidades-living",
      nivel: "media",
      titulo: proximas.length === 1 ? "1 contrato vence en 90 días sin decidir renovación" : `${proximas.length} contratos vencen en 90 días sin decidir renovación`,
      detalle: lista(proximas.map((x) => `${x.unidad} (${x.txt})`)),
      cuenta: proximas.length,
      href,
    });
  return r;
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

type Regla = (c: Contexto) => Promise<Alerta | Alerta[] | null>;
const REGLAS: { modulo: string; f: Regla }[] = [
  { modulo: "limpiezas", f: reservasSinLimpieza },
  { modulo: "limpiezas", f: limpiezasSinFuncionaria },
  { modulo: "comercial-host", f: leadsSinContacto },
  { modulo: "comercial-living", f: leadsLivingSinContacto },
  { modulo: "tickets", f: ticketsVencidos },
  { modulo: "cobros", f: cobrosVencidos },
  { modulo: "contratos", f: contratosPorTerminar },
  { modulo: "unidades-living", f: renovacionesSinDecidir },
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
  return todas.flat().filter((a): a is Alerta => Boolean(a)).sort((a, b) => (a.nivel === b.nivel ? b.cuenta - a.cuenta : a.nivel === "alta" ? -1 : 1));
}

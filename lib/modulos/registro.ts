import { puede, type Sesion } from "@/lib/acceso/permisos";
import type { EmpresaBase } from "@/lib/acceso/estructura";
import { veAprobar } from "@/lib/hoy/aprobar";
import { PESTANAS, type Pestana } from "./finanzas";
import type { DefTabla } from "./tabla";
import { TABLAS_EQUIPO } from "./tablas-equipo";

/**
 * Registro central de módulos. Cada tipo de pantalla declara su nombre, icono, segmento de
 * ruta, de qué datos vive y si ya está construido. Empresas, verticales y módulos salen de
 * la base (Ajustes); el registro solo dice cómo se muestra cada tipo. La barra lateral es
 * registro ∩ estructura ∩ permisos: un módulo sin acceso o sin construir no aparece.
 */

export type Contador = "hoy" | "aprobar";

export interface DefModulo {
  tipo: string;
  /** Nombre por defecto; manda el de la base si existe. */
  nombre: string;
  /** Nombre de un icono de lucide-react (se resuelve en components/shell/iconos.tsx). */
  icono: string;
  /** Segmento en /[empresa]/[vertical]/[modulo]. */
  segmento: string;
  /** Tablas de Airtable o servicios de los que vive. */
  fuentes: string[];
  construido: boolean;
  contador?: Contador;
  /** Por defecto: ver el módulo. Algunos tipos tienen una regla propia. */
  visible?: (s: Sesion, empresa: string, moduloId: string) => boolean;
  /** Aparece en la vista Todas (cruza empresas). */
  enTodas?: boolean;
  /** Una línea bajo el título del módulo. */
  descripcion?: string;
  /** Módulo de tabla: lista sobre una tabla de Airtable leída en el momento (lib/modulos/tabla.ts). */
  tabla?: DefTabla;
  /** Módulo con pestañas: cada una una tabla; se lee solo la abierta (lib/modulos/finanzas.ts). */
  pestanas?: Pestana[];
}

export const REGISTRO: DefModulo[] = [
  { tipo: "hoy", nombre: "Hoy", icono: "inbox", segmento: "hoy", fuentes: ["TRAZABILIDAD"], construido: true, contador: "hoy", enTodas: true },
  {
    tipo: "aprobar",
    nombre: "Para aprobar",
    icono: "check-check",
    segmento: "aprobar",
    fuentes: ["TRAZABILIDAD"],
    construido: true,
    contador: "aprobar",
    enTodas: true,
    // Lo ve quien tiene la casilla Aprobar o el módulo en ver.
    visible: (s, empresa, moduloId) => veAprobar(s, empresa) || puede(s, empresa, moduloId, "ver"),
  },
  { tipo: "correo", nombre: "Correo", icono: "mail", segmento: "correo", fuentes: ["Gmail por Composio"], construido: true },
  { tipo: "sistema", nombre: "Sistema", icono: "activity", segmento: "sistema", fuentes: ["TRAZABILIDAD", "Postgres"], construido: true },
  {
    tipo: "finanzas",
    nombre: "Finanzas",
    icono: "landmark",
    segmento: "finanzas",
    fuentes: ["AGREGADO", "CRUCES", "EXTRACTOS", "MOVIMIENTOS", "OVERHEAD", "REPORTES", "CAJA MENOR VERSE", "GLOBAL VERSE", "MOVIMIENTOS VERSE"],
    construido: true,
    descripcion: "Cierre del mes, bancos, cruces, overhead y caja menor",
    pestanas: PESTANAS["finanzas"],
  },
  { tipo: "equipo", nombre: "Equipo", icono: "users", segmento: "equipo", fuentes: ["CONTROL HORAS", "OBJETIVOS", "NOMINA"], construido: true, descripcion: "Turnos de la semana", tabla: TABLAS_EQUIPO["equipo"] },
  { tipo: "operacion", nombre: "Operación", icono: "calendar-days", segmento: "operacion", fuentes: ["RESERVAS", "HUESPEDES", "ADICIONALES"], construido: true, descripcion: "Reservas del mes", tabla: TABLAS_EQUIPO["operacion"] },
  { tipo: "limpiezas", nombre: "Limpiezas", icono: "sparkles", segmento: "limpiezas", fuentes: ["LIMPIEZA", "SERVICIOS"], construido: true, descripcion: "Limpiezas de la semana", tabla: TABLAS_EQUIPO["limpiezas"] },
  { tipo: "ruta", nombre: "Ruta de aseo", icono: "route", segmento: "ruta", fuentes: ["FUNCIONARIAS", "LIMPIEZA", "SERVICIOS", "CONTROL HORAS"], construido: true },
  { tipo: "unidades-host", nombre: "Unidades Host", icono: "building-2", segmento: "unidades", fuentes: ["UNIDADES", "EDIFICIOS", "PROPIETARIOS"], construido: true, descripcion: "Unidades de Verse Host con su edificio, propietario y estado", tabla: TABLAS_EQUIPO["unidades-host"] },
  { tipo: "liquidaciones", nombre: "Liquidaciones", icono: "receipt", segmento: "liquidaciones", fuentes: ["F_CORTAS", "F_LIMPIEZA", "POLIZAS", "PAGOS"], construido: true, descripcion: "Liquidaciones del mes", tabla: TABLAS_EQUIPO["liquidaciones"] },
  { tipo: "alistamiento", nombre: "Alistamiento", icono: "package", segmento: "alistamiento", fuentes: ["PROY_AMOB", "ITEMS_AMOB", "COT LENCERIA"], construido: true, descripcion: "Pedidos de amoblamiento por unidad", tabla: TABLAS_EQUIPO["alistamiento"] },
  { tipo: "comercial-host", nombre: "Comercial Host", icono: "megaphone", segmento: "comercial", fuentes: ["LEADS", "CONJUNTOS"], construido: true, descripcion: "Leads de propietarios del mes", tabla: TABLAS_EQUIPO["comercial-host"] },
  { tipo: "tickets", nombre: "Tickets", icono: "wrench", segmento: "tickets", fuentes: ["TICKETS"], construido: true, descripcion: "Novedades abiertas y cerradas en 30 días", tabla: TABLAS_EQUIPO["tickets"] },
  { tipo: "unidades-living", nombre: "Unidades Living", icono: "building", segmento: "unidades", fuentes: ["UNIDADES (7. LIVING)"], construido: true, descripcion: "Unidades de Living y su ocupación", tabla: TABLAS_EQUIPO["unidades-living"] },
  { tipo: "contratos", nombre: "Contratos", icono: "file-signature", segmento: "contratos", fuentes: ["CONTRATO", "FIRMAS", "ACTAS"], construido: true, descripcion: "Contratos activos en el mes", tabla: TABLAS_EQUIPO["contratos"] },
  { tipo: "cobros", nombre: "Cobros", icono: "wallet", segmento: "cobros", fuentes: ["INGRESOS", "VL"], construido: true, descripcion: "Cánones del mes", tabla: TABLAS_EQUIPO["cobros"] },
  { tipo: "balcony", nombre: "Balcony PH", icono: "hotel", segmento: "balcony", fuentes: ["EDIFICIO BALCONY PH"], construido: false },
  { tipo: "comercial-living", nombre: "Comercial Living", icono: "megaphone", segmento: "comercial", fuentes: ["WEB LEADS"], construido: true, descripcion: "Leads de la web", tabla: TABLAS_EQUIPO["comercial-living"] },
  {
    tipo: "finanzas-cyc",
    nombre: "Finanzas",
    icono: "landmark",
    segmento: "finanzas",
    fuentes: ["BANCOS", "EXTRACTOS", "MOVIMIENTOS C&C", "GLOBAL C&C", "REFERENCIAS BANCARIAS"],
    construido: true,
    descripcion: "Pagos, extractos, caja y referencias bancarias",
    pestanas: PESTANAS["finanzas-cyc"],
  },
  { tipo: "actas", nombre: "Actas", icono: "clipboard-list", segmento: "actas", fuentes: ["ACTAS", "ITEMS ACTAS"], construido: true, descripcion: "Actas de corte por contratista", tabla: TABLAS_EQUIPO["actas"] },
  { tipo: "pagos-obra", nombre: "Pagos de obra", icono: "banknote", segmento: "pagos", fuentes: ["CONTABILIDAD (12. EDIFICIO 54-47)"], construido: true, descripcion: "Pagos de obra del mes", tabla: TABLAS_EQUIPO["pagos-obra"] },
  { tipo: "contratistas", nombre: "Contratistas", icono: "hard-hat", segmento: "contratistas", fuentes: ["CONTRATISTAS", "ANTICIPOS"], construido: true, descripcion: "Contratistas, contratos y retenciones", tabla: TABLAS_EQUIPO["contratistas"] },
  { tipo: "calidad", nombre: "Calidad", icono: "flask-conical", segmento: "calidad", fuentes: ["PRUEBAS CONCRETO"], construido: true, descripcion: "Pruebas de concreto", tabla: TABLAS_EQUIPO["calidad"] },
  { tipo: "diseno", nombre: "Diseño y compras", icono: "ruler", segmento: "diseno", fuentes: ["ESPECIFICACION", "FACHADA", "MEDIDAS FINALES"], construido: false },
];

export const TODAS = "todas";

export const defDe = (tipo: string): DefModulo | undefined => REGISTRO.find((d) => d.tipo === tipo);

/** Segmento de la vertical en la URL: su id sin el prefijo de la empresa (verse-host → host). */
export const segmentoVertical = (empresa: string, verticalId: string) => (verticalId.startsWith(`${empresa}-`) ? verticalId.slice(empresa.length + 1) : verticalId);

export interface ItemNav {
  id: string;
  tipo: string;
  nombre: string;
  icono: string;
  href: string;
  contador?: Contador;
}

export interface GrupoNav {
  vertical: string;
  nombre: string;
  items: ItemNav[];
}

function visible(s: Sesion, empresa: string, moduloId: string, def: DefModulo): boolean {
  return def.visible ? def.visible(s, empresa, moduloId) : puede(s, empresa, moduloId, "ver");
}

/** Barra lateral de una empresa: módulos construidos que la persona puede ver, por vertical. */
export function navegacion(s: Sesion, estructura: EmpresaBase[], empresa: string): GrupoNav[] {
  if (empresa === TODAS) return navegacionTodas(s, estructura);
  const e = estructura.find((x) => x.id === empresa);
  if (!e) return [];
  return e.verticales
    .map((v) => {
      const seg = segmentoVertical(empresa, v.id);
      const items = v.modulos.flatMap((m) => {
        const def = m.tipo ? defDe(m.tipo) : undefined;
        if (!def?.construido || !visible(s, empresa, m.id, def)) return [];
        return [{ id: m.id, tipo: def.tipo, nombre: m.nombre || def.nombre, icono: def.icono, href: `/${empresa}/${seg}/${def.segmento}`, contador: def.contador }];
      });
      return { vertical: v.id, nombre: v.nombre, items };
    })
    .filter((g) => g.items.length > 0);
}

/** Vista Todas: solo lo que cruza empresas (Hoy y Para aprobar), si lo ve en al menos una. */
function navegacionTodas(s: Sesion, estructura: EmpresaBase[]): GrupoNav[] {
  const tipos = REGISTRO.filter((d) => d.enTodas && d.construido);
  const items = tipos.flatMap((def) => {
    const alguna = estructura.some((e) => e.verticales.some((v) => v.modulos.some((m) => m.tipo === def.tipo && visible(s, e.id, m.id, def))));
    return alguna ? [{ id: `todas-${def.tipo}`, tipo: def.tipo, nombre: def.nombre, icono: def.icono, href: `/${TODAS}/general/${def.segmento}`, contador: def.contador }] : [];
  });
  return items.length ? [{ vertical: "todas-general", nombre: "General", items }] : [];
}

export interface Ubicacion {
  empresa: string;
  vertical: { id: string; nombre: string; segmento: string };
  modulo: { id: string; nombre: string; tipo: string };
  def: DefModulo;
}

/** De la URL al módulo, solo si existe, está construido y la persona lo puede ver. */
export function ubicar(s: Sesion, estructura: EmpresaBase[], empresa: string, vertical: string, segmento: string): Ubicacion | null {
  if (empresa === TODAS) {
    const def = REGISTRO.find((d) => d.enTodas && d.segmento === segmento);
    const item = navegacionTodas(s, estructura)[0]?.items.find((i) => i.tipo === def?.tipo);
    if (!def || !item || vertical !== "general") return null;
    return { empresa, vertical: { id: "todas-general", nombre: "General", segmento: "general" }, modulo: { id: item.id, nombre: def.nombre, tipo: def.tipo }, def };
  }
  const e = estructura.find((x) => x.id === empresa);
  const v = e?.verticales.find((x) => segmentoVertical(empresa, x.id) === vertical);
  if (!v) return null;
  for (const m of v.modulos) {
    const def = m.tipo ? defDe(m.tipo) : undefined;
    if (def?.construido && def.segmento === segmento && visible(s, empresa, m.id, def)) {
      return { empresa, vertical: { id: v.id, nombre: v.nombre, segmento: vertical }, modulo: { id: m.id, nombre: m.nombre || def.nombre, tipo: def.tipo }, def };
    }
  }
  return null;
}

/** Primera pantalla de la persona: Hoy de su primera empresa, o el primer módulo que vea. */
export function inicioDe(s: Sesion, estructura: EmpresaBase[], empresas: string[]): string | null {
  for (const e of empresas) {
    const grupos = navegacion(s, estructura, e);
    const hoy = grupos.flatMap((g) => g.items).find((i) => i.tipo === "hoy");
    if (hoy) return hoy.href;
  }
  for (const e of empresas) {
    const primero = navegacion(s, estructura, e)[0]?.items[0];
    if (primero) return primero.href;
  }
  return null;
}

/** Para Ajustes: cada módulo de la base con su estado en el registro. */
export function estadoModulos(estructura: EmpresaBase[]) {
  return estructura.map((e) => ({
    empresa: e.id,
    verticales: e.verticales.map((v) => ({
      id: v.id,
      nombre: v.nombre,
      modulos: v.modulos.map((m) => {
        const def = m.tipo ? defDe(m.tipo) : undefined;
        return { id: m.id, nombre: m.nombre, tipo: m.tipo ?? "", disponible: Boolean(def?.construido), fuentes: def?.fuentes ?? [] };
      }),
    })),
  }));
}

import { puede, type Sesion } from "@/lib/acceso/permisos";
import type { EmpresaBase } from "@/lib/acceso/estructura";
import { veAprobar } from "@/lib/hoy/aprobar";

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
  { tipo: "finanzas", nombre: "Finanzas", icono: "landmark", segmento: "finanzas", fuentes: ["AGREGADO", "CRUCES", "EXTRACTOS", "OVERHEAD"], construido: false },
  { tipo: "equipo", nombre: "Equipo", icono: "users", segmento: "equipo", fuentes: ["CONTROL HORAS", "OBJETIVOS", "NOMINA"], construido: false },
  { tipo: "operacion", nombre: "Operación", icono: "calendar-days", segmento: "operacion", fuentes: ["RESERVAS", "HUESPEDES", "ADICIONALES"], construido: false },
  { tipo: "limpiezas", nombre: "Limpiezas", icono: "sparkles", segmento: "limpiezas", fuentes: ["LIMPIEZA", "SERVICIOS"], construido: false },
  { tipo: "ruta", nombre: "Ruta de aseo", icono: "route", segmento: "ruta", fuentes: ["LIMPIEZA", "SERVICIOS", "CONTROL HORAS"], construido: false },
  { tipo: "unidades-host", nombre: "Unidades Host", icono: "building-2", segmento: "unidades", fuentes: ["UNIDADES", "EDIFICIOS", "PROPIETARIOS"], construido: false },
  { tipo: "liquidaciones", nombre: "Liquidaciones", icono: "receipt", segmento: "liquidaciones", fuentes: ["F_CORTAS", "F_LIMPIEZA", "POLIZAS", "PAGOS"], construido: false },
  { tipo: "alistamiento", nombre: "Alistamiento", icono: "package", segmento: "alistamiento", fuentes: ["PROY_AMOB", "ITEMS_AMOB", "COT LENCERIA"], construido: false },
  { tipo: "comercial-host", nombre: "Comercial Host", icono: "megaphone", segmento: "comercial", fuentes: ["LEADS", "CONJUNTOS"], construido: false },
  { tipo: "unidades-living", nombre: "Unidades Living", icono: "building", segmento: "unidades", fuentes: ["UNIDADES (7. LIVING)"], construido: false },
  { tipo: "contratos", nombre: "Contratos", icono: "file-signature", segmento: "contratos", fuentes: ["CONTRATO", "FIRMAS", "ACTAS"], construido: false },
  { tipo: "cobros", nombre: "Cobros", icono: "wallet", segmento: "cobros", fuentes: ["INGRESOS", "VL"], construido: false },
  { tipo: "balcony", nombre: "Balcony PH", icono: "hotel", segmento: "balcony", fuentes: ["EDIFICIO BALCONY PH"], construido: false },
  { tipo: "comercial-living", nombre: "Comercial Living", icono: "megaphone", segmento: "comercial", fuentes: ["WEB LEADS"], construido: false },
  { tipo: "finanzas-cyc", nombre: "Finanzas", icono: "landmark", segmento: "finanzas", fuentes: ["EXTRACTOS", "BANCOS", "MOVIMIENTOS C&C"], construido: false },
  { tipo: "actas", nombre: "Actas", icono: "clipboard-list", segmento: "actas", fuentes: ["ACTAS", "ITEMS ACTAS"], construido: false },
  { tipo: "pagos-obra", nombre: "Pagos de obra", icono: "banknote", segmento: "pagos", fuentes: ["CONTABILIDAD (12. EDIFICIO 54-47)"], construido: false },
  { tipo: "contratistas", nombre: "Contratistas", icono: "hard-hat", segmento: "contratistas", fuentes: ["CONTRATISTAS", "ANTICIPOS"], construido: false },
  { tipo: "calidad", nombre: "Calidad", icono: "flask-conical", segmento: "calidad", fuentes: ["PRUEBAS CONCRETO"], construido: false },
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

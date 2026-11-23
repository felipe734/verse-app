import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { sensibles, type Sesion } from "@/lib/acceso/permisos";
import type { DefCreacion } from "./crear";
import type { Columna, DefTabla } from "./tabla";
import { ids } from "./tablas-equipo";

/**
 * Finanzas de Verse y de C&C (entrega 5): un módulo con pestañas, cada una una tabla de
 * Airtable leída en el momento. Se lee solo la pestaña abierta. Campos revisados contra el
 * esquema (2026-11-23). Montos y terceros por casilla; números de cuenta nunca se piden.
 */

export interface Pestana {
  id: string;
  nombre: string;
  tabla: DefTabla;
  /** Crear filas desde la pestaña (gastos de caja menor). */
  crear?: DefCreacion;
}

const t = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta });
const fecha = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta, tipo: "fecha" });
const estado = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta, tipo: "estado" });
const plata = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta, tipo: "dinero", sensible: "cifras" });
const tercero = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta, sensible: "terceros" });

const desde = (campo: string, dias: number) => (hoy: string) => `IS_AFTER({${campo}}, DATEADD(DATETIME_PARSE('${hoy}'), ${-dias - 1}, 'days'))`;

const fondeos = (base: string, tabla: string): DefTabla => ({
  ...ids(base, tabla),
  titulo: "Concepto",
  columnas: [t("Concepto"), fecha("Fecha"), plata("Valor")],
  formula: desde("Fecha", 120),
  orden: { campo: "Fecha", desc: true },
  vacio: "No hay fondeos en los últimos cuatro meses",
});

const cajaGlobal = (base: string, tabla: string, tercero_: string): DefTabla => ({
  ...ids(base, tabla),
  titulo: "Concepto",
  columnas: [t("Concepto"), fecha("Fecha"), estado("Tipo"), tercero(tercero_, tercero_ === "Tercero" ? undefined : tercero_), plata("Egreso"), plata("Ingreso"), estado("Estado")],
  detalle: [t("Tipo Soporte", "Soporte"), t("Arqueo"), t("Comentario"), tercero("NIT / CC")],
  formula: desde("Fecha", 60),
  orden: { campo: "Fecha", desc: true },
  max: 300,
  vacio: "No hay movimientos de caja en los últimos dos meses",
});

export const PESTANAS: Record<"finanzas" | "finanzas-cyc", Pestana[]> = {
  finanzas: [
    {
      id: "movimientos",
      nombre: "Movimientos",
      tabla: {
        ...ids("1. VL PRIVADO", "MOVIMIENTOS"),
        titulo: "Movimiento",
        columnas: [t("Movimiento"), fecha("Fecha"), estado("Banco"), estado("Categoría"), plata("Débito"), plata("Crédito"), estado("Estado"), estado("Revisar")],
        detalle: [t("Descripción banco"), plata("Saldo"), t("Soporte"), t("Link soporte"), t("Motivo revisión"), t("Comentario")],
        formula: desde("Fecha", 45),
        orden: { campo: "Fecha", desc: true },
        max: 400,
        vacio: "No hay movimientos bancarios en los últimos 45 días",
        editar: { tabla: "movimientos", campos: [{ campo: "estado", etiqueta: "Estado" }, { campo: "categoria", etiqueta: "Categoría" }, { campo: "comentario", etiqueta: "Comentario" }] },
      },
    },
    {
      id: "extractos",
      nombre: "Extractos",
      tabla: {
        ...ids("1. VL PRIVADO", "EXTRACTOS"),
        titulo: "ID",
        columnas: [t("ID", "Extracto"), fecha("Fecha"), estado("Tipo", "Banco")],
        orden: { campo: "Fecha", desc: true },
        max: 36,
      },
    },
    {
      id: "cruces",
      nombre: "Cruces",
      tabla: {
        ...ids("2. FACTURACION", "CRUCES"),
        titulo: "Concepto",
        columnas: [t("Concepto"), t("Mes"), fecha("Fecha"), tercero("Tercero"), plata("Valor"), estado("Estado")],
        orden: { campo: "Fecha", desc: true },
        max: 120,
      },
    },
    {
      id: "overhead",
      nombre: "Overhead",
      tabla: {
        ...ids("1. VL PRIVADO", "OVERHEAD"),
        titulo: "Item",
        columnas: [t("Item"), t("Mes"), estado("Categoria", "Categoría"), plata("Valor"), estado("Estado")],
        detalle: [t("Fuente")],
        orden: { campo: "Mes", desc: true },
        max: 200,
      },
    },
    {
      id: "caja",
      nombre: "Caja menor",
      tabla: {
        ...ids("3. ADMIN", "CAJA MENOR VERSE"),
        titulo: "Concepto",
        columnas: [t("Concepto"), fecha("Fecha"), t("Persona"), t("Apto"), plata("Valor"), estado("Estado")],
        formula: desde("Fecha", 60),
        orden: { campo: "Fecha", desc: true },
        max: 300,
        vacio: "No hay gastos de caja menor en los últimos dos meses",
      },
      crear: {
        tabla: "cajaVerse",
        titulo: "Nuevo gasto",
        campos: [
          { campo: "concepto", etiqueta: "Concepto", requerido: true },
          { campo: "valor", etiqueta: "Valor", requerido: true },
          { campo: "fecha", etiqueta: "Fecha", requerido: true, defecto: "hoy" },
          { campo: "persona", etiqueta: "Persona", requerido: true },
          { campo: "apto", etiqueta: "Apto" },
          { campo: "foto", etiqueta: "Foto del soporte" },
        ],
      },
    },
    { id: "caja-global", nombre: "Caja global", tabla: cajaGlobal("4. CAJA MENOR", "MOVIMIENTOS VERSE", "Proveedor") },
    { id: "fondeos", nombre: "Fondeos", tabla: fondeos("4. CAJA MENOR", "GLOBAL VERSE") },
    {
      id: "reportes",
      nombre: "Reportes",
      tabla: {
        ...ids("1. VL PRIVADO", "REPORTES"),
        titulo: "Nombre",
        columnas: [t("Nombre", "Reporte"), fecha("Mes"), estado("Tipo")],
        detalle: [t("Link Drive"), t("Resumen")],
        orden: { campo: "Mes", desc: true },
        max: 60,
      },
    },
  ],
  "finanzas-cyc": [
    {
      id: "bancos",
      nombre: "Pagos",
      tabla: {
        ...ids("2. CONTABILIDAD", "BANCOS"),
        titulo: "Proveedor",
        columnas: [t("Proveedor"), t("ID", "Factura"), fecha("Fecha Pago", "Pago"), estado("Centro de Costos", "Centro de costos"), plata("Valor"), estado("Estado"), t("Método de Pago", "Método")],
        detalle: [fecha("Fecha Emisión", "Emisión"), t("Comentario")],
        orden: { campo: "Fecha Emisión", desc: true },
        max: 300,
      },
    },
    {
      id: "extractos",
      nombre: "Extractos",
      tabla: {
        ...ids("2. CONTABILIDAD", "EXTRACTOS"),
        titulo: "ID",
        columnas: [t("ID", "Extracto"), fecha("Fecha"), estado("Tipo", "Banco")],
        orden: { campo: "Fecha", desc: true },
        max: 36,
      },
    },
    {
      id: "caja",
      nombre: "Caja",
      tabla: cajaGlobal("4. CAJA MENOR", "MOVIMIENTOS C&C", "Tercero"),
      crear: {
        tabla: "cajaCyC",
        titulo: "Nuevo gasto",
        campos: [
          { campo: "concepto", etiqueta: "Concepto", requerido: true },
          { campo: "egreso", etiqueta: "Valor", requerido: true },
          { campo: "fecha", etiqueta: "Fecha", requerido: true, defecto: "hoy" },
          { campo: "tipo", etiqueta: "Tipo" },
          { campo: "tercero", etiqueta: "Tercero" },
          { campo: "nit", etiqueta: "NIT o cédula" },
          { campo: "responsable", etiqueta: "Responsable" },
          { campo: "tipoSoporte", etiqueta: "Tipo de soporte" },
          { campo: "soporte", etiqueta: "Foto del soporte" },
          { campo: "comentario", etiqueta: "Comentario" },
        ],
      },
    },
    { id: "fondeos", nombre: "Fondeos", tabla: fondeos("4. CAJA MENOR", "GLOBAL C&C") },
    {
      id: "referencias",
      nombre: "Referencias bancarias",
      tabla: {
        ...ids("1. C&C GROUP", "REFERENCIAS BANCARIAS"),
        titulo: "RAZÓN SOCIAL",
        // El número de cuenta no se pide nunca: para pagar se usa Airtable.
        columnas: [t("RAZÓN SOCIAL", "Razón social"), t("TIPO DOC", "Tipo doc"), tercero("DOC", "Documento"), estado("BANCO", "Banco"), t("CUENTA", "Tipo de cuenta")],
        orden: { campo: "RAZÓN SOCIAL", desc: false },
        max: 300,
      },
    },
  ],
};

export const pestanaDe = (tipo: string, id?: string): Pestana | undefined => {
  const lista = PESTANAS[tipo as keyof typeof PESTANAS];
  return lista?.find((p) => p.id === id) ?? lista?.[0];
};

/** Cierre mensual de Verse (AGREGADO): los últimos meses con ingresos, contribución, overhead y margen. */
export interface MesCierre {
  mes: string;
  ingresos: number | null;
  contribucion: number | null;
  overhead: number | null;
  margen: number | null;
}

const CAMPOS_CIERRE = { ingresos: "TOTAL INGRESOS", contribucion: "CONTRIBUCIÓN TOTAL", overhead: "OVERHEAD COSTO", margen: "MARGEN NETO" } as const;

/** "$12.345.678" o "-$1.200" (cellFormat string, es-CO) → número. */
export function aNumero(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || !v.trim()) return null;
  const negativo = /^\s*-|\(/.test(v);
  const limpio = v.replace(/[^\d,]/g, "").replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isNaN(n) ? null : negativo ? -n : n;
}

/** D/M/AAAA → AAAA-MM. */
const mesDe = (v: unknown) => {
  const m = typeof v === "string" ? v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) : null;
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}` : null;
};

export async function leerCierre(airtable: ClienteAirtable, s: Sesion, meses = 6): Promise<MesCierre[] | null> {
  if (!sensibles(s, "verse", "verse-general").cifras) return null;
  const { idBase, idTabla } = ids("2. FACTURACION", "AGREGADO");
  const filas = await airtable.consultar(idBase, idTabla, { campos: ["Fecha", ...Object.values(CAMPOS_CIERRE)], orden: { campo: "Fecha", desc: true }, max: meses });
  return filas
    .map((f) => ({
      mes: mesDe(f.fields["Fecha"]) ?? "",
      ingresos: aNumero(f.fields[CAMPOS_CIERRE.ingresos]),
      contribucion: aNumero(f.fields[CAMPOS_CIERRE.contribucion]),
      overhead: aNumero(f.fields[CAMPOS_CIERRE.overhead]),
      margen: aNumero(f.fields[CAMPOS_CIERRE.margen]),
    }))
    .filter((m) => m.mes)
    .sort((a, b) => b.mes.localeCompare(a.mes));
}

import { documento, enLetras, fechaLarga, pesos } from "./letras";
import { vlColiving, vlViviendaBalcony, vlViviendaLiving } from "./modelos";
import { fin, TIPOS_DOC, type DatosContrato, type ModeloId } from "./tipos";

export { fin, MODELOS, TIPOS_DOC, type DatosContrato, type ModeloId, type TipoDoc } from "./tipos";

/**
 * Generador de contratos de Living (fase 2.2): plantilla aprobada + datos de Airtable, sin IA.
 * El texto fijo del modelo no se toca; solo se reemplazan los campos {{ }}. Si falta uno, no
 * se genera. La revisión de verse-docs compara después el PDF contra el mismo modelo.
 */

const FUENTES: Record<ModeloId, string> = { "vl-vivienda-living": vlViviendaLiving, "vl-vivienda-balcony": vlViviendaBalcony, "vl-coliving": vlColiving };

export function modeloDeUnidad(unidad: string): { modelo: ModeloId; numero: string } | null {
  const u = unidad.trim().toUpperCase();
  const hab = u.match(/^VL\s*H(\d+)/);
  if (hab) return { modelo: "vl-coliving", numero: hab[1]! };
  const vl = u.match(/^VL\s*(\d+)/);
  if (vl) return { modelo: "vl-vivienda-living", numero: vl[1]! };
  const eb = u.match(/^EB\s*(\d+)/);
  if (eb) return { modelo: "vl-vivienda-balcony", numero: eb[1]! };
  return null;
}

const mesesTexto = (n: number) => (n === 1 ? "un (1) mes" : `${enLetras(n)} (${n}) meses`);

/** Qué le falta a los datos para el modelo; vacío si se puede generar. */
export function faltantes(d: DatosContrato): string[] {
  const f: string[] = [];
  const req = (v: unknown, nombre: string) => {
    if (v === undefined || v === null || (typeof v === "string" && !v.trim()) || (typeof v === "number" && !(v > 0))) f.push(nombre);
  };
  req(d.nombre, "nombre del arrendatario");
  req(d.numeroDoc, "número de documento");
  req(d.correo, "correo");
  req(d.whatsapp, "WhatsApp");
  req(d.numero, "número de apartamento o habitación");
  req(d.canon, "canon");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.inicio)) f.push("fecha de inicio");
  if (!Number.isInteger(d.meses) || d.meses < 1 || d.meses > 60) f.push("duración en meses (1 a 60)");
  if (d.modelo !== "vl-coliving") {
    req(d.lugarExpedicion, "lugar de expedición del documento");
    req(d.admin, "cuota de administración");
    req(d.referenciaPago, "referencia de pago");
  }
  if (d.modelo === "vl-vivienda-balcony") {
    req(d.matricula, "matrícula inmobiliaria");
    req(d.contadorEnel, "contador de ENEL");
    req(d.contratoEaab, "contrato de EAAB");
  }
  return f;
}

/** Valores de los campos {{ }} del modelo. */
export function valores(d: DatosContrato): Record<string, string> {
  const comun: Record<string, string> = {
    TIPO_DOC: TIPOS_DOC[d.tipoDoc],
    NUMERO_DOC: documento(d.numeroDoc),
    CORREO: d.correo.trim(),
    WHATSAPP: d.whatsapp.trim(),
    FECHA_INICIO: fechaLarga(d.inicio),
    FECHA_TERMINACION: fechaLarga(fin(d)),
    CANON_NUMEROS: pesos(d.canon),
    CANON_LETRAS: enLetras(Math.round(d.canon)),
  };
  if (d.modelo === "vl-coliving") {
    const dias = d.diasPreaviso && d.diasPreaviso > 0 ? d.diasPreaviso : 30;
    return { ...comun, NOMBRE_RESIDENTE: d.nombre.trim(), NUMERO_HABITACION: d.numero, DURACION_EN_LETRAS: mesesTexto(d.meses), DIAS_PREAVISO: String(dias), DIAS_PREAVISO_LETRAS: enLetras(dias) };
  }
  const v: Record<string, string> = {
    ...comun,
    NOMBRE_ARRENDATARIO: d.nombre.trim(),
    LUGAR_EXPEDICION: (d.lugarExpedicion ?? "").trim(),
    NUMERO_APARTAMENTO: d.numero,
    PARQUEADERO: d.parqueadero?.trim() || "No aplica",
    DURACION_MESES: String(d.meses),
    DURACION_LETRAS: enLetras(d.meses),
    ADMINISTRACION_NUMEROS: pesos(d.admin ?? 0),
    ADMINISTRACION_LETRAS: enLetras(Math.round(d.admin ?? 0)),
    REFERENCIA_PAGO: (d.referenciaPago ?? "").trim(),
  };
  if (d.modelo === "vl-vivienda-balcony") {
    v.MATRICULA_INMOBILIARIA = (d.matricula ?? "").trim();
    v.CONTADOR_ENEL = (d.contadorEnel ?? "").trim();
    v.CONTRATO_EAAB = (d.contratoEaab ?? "").trim();
  }
  return v;
}

export interface ModeloLleno {
  meta: Record<string, string>;
  texto: string;
}

/** Reemplaza los campos del modelo. Lanza si queda alguno sin valor. */
export function llenar(d: DatosContrato): ModeloLleno {
  const fuente = FUENTES[d.modelo];
  const fm = fuente.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error("Modelo sin encabezado");
  const meta: Record<string, string> = {};
  for (const l of fm[1]!.split("\n")) {
    const i = l.indexOf(":");
    if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  let cuerpo = fuente.slice(fm[0].length);
  // Balcony: la fila Parqueadero solo va si se pidió (uso del modelo).
  if (d.modelo === "vl-vivienda-balcony" && !d.parqueadero?.trim()) cuerpo = cuerpo.replace(/^\| Parqueadero \| \{\{PARQUEADERO\}\} \|\n/m, "");
  const v = valores(d);
  const texto = cuerpo.replace(/\{\{([A-Z_0-9]+)\}\}/g, (_, k: string) => {
    const x = v[k];
    if (!x) throw new Error(`Falta el campo ${k}`);
    return x;
  });
  return { meta, texto };
}

export type Bloque =
  | { tipo: "titulo" | "seccion" | "parrafo" | "numeral" | "vineta"; texto: string }
  | { tipo: "tabla"; filas: ({ grupo: string } | { celdas: [string, string] })[] }
  | { tipo: "salto" | "nota" }
  | { tipo: "firmas"; filas: [string, string][] };

/** Del Markdown del modelo a bloques para el PDF (el mismo subconjunto que generar.js de verse-legal). */
export function bloques(texto: string): Bloque[] {
  const lineas = texto.split("\n");
  const r: Bloque[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]!;
    if (!l.trim()) continue;
    if (l.startsWith("# ")) r.push({ tipo: "titulo", texto: l.slice(2).trim() });
    else if (l.startsWith("## ")) r.push({ tipo: "seccion", texto: l.slice(3).trim() });
    else if (l.trim() === "::salto") r.push({ tipo: "salto" });
    else if (l.trim() === "::nota") r.push({ tipo: "nota" });
    else if (l.trim() === "::firmas") {
      const filas: [string, string][] = [];
      while (i + 1 < lineas.length && lineas[i + 1]!.trim()) {
        const [a = "", b = ""] = lineas[++i]!.split("||").map((x) => x.trim());
        filas.push([a, b]);
      }
      r.push({ tipo: "firmas", filas });
    } else if (l.startsWith("|")) {
      const filas: ({ grupo: string } | { celdas: [string, string] })[] = [];
      i--;
      while (i + 1 < lineas.length && lineas[i + 1]!.startsWith("|")) {
        const celdas = lineas[++i]!.split("|").slice(1, -1).map((x) => x.trim());
        if (celdas[0]?.startsWith("::")) filas.push({ grupo: celdas[0].slice(2).trim() });
        else if (!/^-+$/.test(celdas[0] ?? "")) filas.push({ celdas: [celdas[0] ?? "", celdas[1] ?? ""] });
      }
      r.push({ tipo: "tabla", filas });
    } else if (/^\d+\. /.test(l)) r.push({ tipo: "numeral", texto: l.trim() });
    else if (l.startsWith("- ")) r.push({ tipo: "vineta", texto: l.slice(2).trim() });
    else r.push({ tipo: "parrafo", texto: l.trim() });
  }
  return r;
}

import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { puede, type Sesion } from "@/lib/acceso/permisos";
import { auditar } from "@/lib/auditoria";
import { comparar, type LeerDocumento } from "./cedula";
import { enLetras } from "./letras";
import { faltantes, fin, MODELOS, modeloDeUnidad, TIPOS_DOC, type DatosContrato, type TipoDoc } from "./llenar";

/**
 * Contrato nuevo desde la app (fase 2.2): se elige la unidad (UNIDADES de 7. LIVING, la fila de
 * esa estadía) y los datos del residente (DATOS). La app llena el modelo aprobado, Haiku lee la
 * cédula y el código compara; si algo no cuadra no se genera. El PDF queda en CONTRATO › Contrato
 * con Estado Elaborado. La firma va aparte (2.3, revisión de verse-docs).
 */

export const MODULO_CONTRATOS = "living-contratos";
const C = ESCRITURA.contratos;
const D = ESCRITURA.datosLiving;
const U = ESCRITURA.unidadesContrato;
const REC = /^rec[A-Za-z0-9]{14}$/;

export const puedeContratos = (s: Sesion | null) => puede(s, "verse", MODULO_CONTRATOS, "editar");

export interface Resultado {
  ok: boolean;
  mensaje: string;
  validacion?: string[];
  recId?: string;
}

const texto = (v: unknown): string => (v === null || v === undefined ? "" : Array.isArray(v) ? v.map(texto).join(", ") : typeof v === "object" && "name" in v ? String((v as { name: unknown }).name) : String(v));
const numero = (v: unknown): number => (typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, "")) || 0);

/** Unidades sin contrato y residentes sin contrato, para el formulario. */
export async function opcionesContrato(airtable: ClienteAirtable): Promise<{ unidades: { recId: string; nombre: string }[]; personas: { recId: string; nombre: string }[] }> {
  const [unidades, personas] = await Promise.all([
    airtable.consultar(U.idBase, U.idTabla, { campos: ["Unidad"], formula: "AND({Contrato} = BLANK(), OR(LEFT({Unidad}, 2) = 'VL', LEFT({Unidad}, 2) = 'EB'))", max: 100, orden: { campo: "Unidad" } }),
    airtable.consultar(D.idBase, D.idTabla, { campos: ["Nombre Completo"], formula: "AND({CONTRATO} = BLANK(), IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -120, 'days')))", max: 100 }),
  ]);
  return {
    unidades: unidades.map((f) => ({ recId: f.id, nombre: texto(f.fields["Unidad"]) })).filter((u) => modeloDeUnidad(u.nombre)),
    personas: personas.map((f) => ({ recId: f.id, nombre: texto(f.fields["Nombre Completo"]) || "Sin nombre" })),
  };
}

/** Lo que se sabe de Airtable para la unidad y el residente; el formulario completa el resto. */
export async function borrador(airtable: ClienteAirtable, unidadRecId: string, datosRecId: string): Promise<{ datos: Partial<DatosContrato>; unidad: string; fotos: number } | { error: string }> {
  if (!REC.test(unidadRecId) || !REC.test(datosRecId)) return { error: "Elige unidad y residente" };
  const [u, d] = await Promise.all([airtable.obtener(U.idBase, U.idTabla, unidadRecId), airtable.obtener(D.idBase, D.idTabla, datosRecId)]);
  if (!u || !d) return { error: "La unidad o el residente ya no existen en Airtable" };
  const nombreUnidad = texto(u.fields[U.campos.unidad.id]);
  const m = modeloDeUnidad(nombreUnidad);
  if (!m) return { error: `No hay modelo de contrato para ${nombreUnidad}` };
  const fotos = [d.fields[D.campos.frente.id], d.fields[D.campos.reverso.id]].flatMap((x) => (Array.isArray(x) ? x : [])).length;
  return {
    unidad: nombreUnidad,
    fotos,
    datos: {
      modelo: m.modelo,
      numero: m.numero,
      nombre: texto(d.fields[D.campos.nombreCompleto.id]).replace(/\s+/g, " ").trim(),
      numeroDoc: texto(d.fields[D.campos.cedula.id]).trim(),
      correo: texto(d.fields[D.campos.correo.id]).trim(),
      whatsapp: texto(d.fields[D.campos.celular.id]).trim(),
      tipoDoc: "CC",
      canon: numero(u.fields[U.campos.canon.id]),
      admin: numero(u.fields[U.campos.admin.id]),
      meses: numero(u.fields[U.campos.duracion.id]) || 12,
      referenciaPago: texto(u.fields[U.campos.referenciaPago.id]),
      matricula: texto(u.fields[U.campos.matricula.id]),
      contadorEnel: texto(u.fields[U.campos.cuentaEnel.id]),
      contratoEaab: texto(u.fields[U.campos.cuentaEaab.id]),
    },
  };
}

export interface Dependencias {
  leer: LeerDocumento | null;
  pdf: (d: DatosContrato) => Promise<Buffer>;
  /** Guarda el PDF y devuelve una URL que Airtable pueda copiar. */
  guardar: (pdf: Buffer, nombre: string) => Promise<string>;
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export async function generarContrato(
  db: Db,
  airtable: ClienteAirtable,
  s: Sesion,
  entrada: { unidadRecId: string; datosRecId: string; datos: DatosContrato; sinValidar?: boolean },
  deps: Dependencias,
): Promise<Resultado> {
  if (!puedeContratos(s)) return { ok: false, mensaje: "No puedes generar contratos" };
  const { unidadRecId, datosRecId, datos } = entrada;
  if (!REC.test(unidadRecId) || !REC.test(datosRecId)) return { ok: false, mensaje: "Elige unidad y residente" };
  if (!(datos.modelo in MODELOS) || !(datos.tipoDoc in TIPOS_DOC)) return { ok: false, mensaje: "Modelo o tipo de documento inválido" };
  const falta = faltantes(datos);
  if (falta.length) return { ok: false, mensaje: `Falta: ${falta.join(", ")}` };

  const [u, d] = await Promise.all([airtable.obtener(U.idBase, U.idTabla, unidadRecId), airtable.obtener(D.idBase, D.idTabla, datosRecId)]);
  if (!u || !d) return { ok: false, mensaje: "La unidad o el residente ya no existen en Airtable" };
  if (Array.isArray(u.fields[U.campos.contrato.id]) && (u.fields[U.campos.contrato.id] as unknown[]).length) return { ok: false, mensaje: "Esa unidad ya tiene contrato" };
  const nombreUnidad = texto(u.fields[U.campos.unidad.id]);
  const m = modeloDeUnidad(nombreUnidad);
  if (!m || m.modelo !== datos.modelo) return { ok: false, mensaje: "El modelo no corresponde a la unidad" };

  // Documento: Haiku lee, el código compara con DATOS. Sin fotos o sin lector solo sigue el Maestro.
  const archivos = [d.fields[D.campos.frente.id], d.fields[D.campos.reverso.id]]
    .flatMap((x) => (Array.isArray(x) ? (x as { url?: string; type?: string }[]) : []))
    .filter((a) => a.url)
    .map((a) => ({ url: a.url!, tipo: a.type ?? "image/jpeg" }));
  let validacion: string[];
  if (archivos.length && deps.leer) {
    const lectura = await deps.leer(archivos);
    const v = comparar(lectura, { nombre: datos.nombre, numero: datos.numeroDoc, fechaNacimiento: texto(d.fields[D.campos.fechaNacimiento.id]) || undefined });
    validacion = v.lineas;
    if (!v.ok && !(entrada.sinValidar && s.maestro)) return { ok: false, mensaje: "El documento no cuadra con los datos. Corrige DATOS o revisa las fotos", validacion };
  } else {
    validacion = [archivos.length ? "Sin lector de documentos (falta ANTHROPIC_API_KEY)" : "DATOS no tiene fotos del documento"];
    if (!(entrada.sinValidar && s.maestro)) return { ok: false, mensaje: `${validacion[0]}. Solo el Maestro puede generar sin validar`, validacion };
  }
  if (entrada.sinValidar && s.maestro) validacion.push(`Generado sin validar por ${s.nombreAirtable ?? s.correo}`);

  const contratoId = nombreUnidad.replace(/\s+/g, "_");
  const pdf = await deps.pdf(datos);
  const url = await deps.guardar(pdf, `${contratoId}.pdf`);
  const vivienda = datos.modelo !== "vl-coliving";
  const dias = vivienda ? 90 : datos.diasPreaviso || 30;
  const campos: Record<string, unknown> = {
    [C.campos.contratoId.id]: contratoId,
    [C.campos.estado.id]: "Elaborado",
    [C.campos.edificio.id]: MODELOS[datos.modelo].edificio,
    [C.campos.unidad.id]: [unidadRecId],
    [C.campos.nombre.id]: [datosRecId],
    [C.campos.mesesLetras.id]: enLetras(datos.meses),
    [C.campos.diasTerminacion.id]: dias,
    [C.campos.diasTerminacionLetras.id]: enLetras(dias),
    [C.campos.unidadContrato.id]: `${vivienda ? "Apartamento" : "Habitación"} ${datos.numero}`,
    [C.campos.direccionUnidad.id]: datos.modelo === "vl-vivienda-balcony" ? "Carrera 23 # 54-37" : "Carrera 23 #54-23",
    [C.campos.fechaInicio.id]: datos.inicio,
    [C.campos.fechaFin.id]: fin(datos),
    [C.campos.letrasCanon.id]: `${mayuscula(enLetras(Math.round(datos.canon)))} pesos`,
    [C.campos.tipoDocumento.id]: datos.tipoDoc as TipoDoc,
    [C.campos.validacion.id]: validacion.join("\n"),
    [C.campos.contrato.id]: [{ url, filename: `${contratoId}.pdf` }],
  };
  if (vivienda) {
    campos[C.campos.cedulaDe.id] = datos.lugarExpedicion?.trim();
    campos[C.campos.letrasAdmin.id] = `${mayuscula(enLetras(Math.round(datos.admin ?? 0)))} pesos`;
  }
  const id = await encolar(db, { idBase: C.idBase, idTabla: C.idTabla, campos, autor: s.correo });
  await procesarCola(db, airtable);
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, id));
  if (fila?.estado !== "hecha" && fila?.estado !== "pendiente") return { ok: false, mensaje: "Airtable no aceptó el contrato", validacion };
  await auditar(db, { autor: s.correo, accion: "contratos.generado", idBase: C.idBase, idTabla: C.idTabla, recId: fila.recId ?? null, detalle: `${contratoId} · ${datos.modelo}` });
  return { ok: true, mensaje: `Contrato ${contratoId} elaborado`, validacion, recId: fila.recId ?? undefined };
}

import { inArray } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { respaldoAdjuntos } from "@/db/esquema";
import type { CampoNuevo, ClienteAirtable, RegistroAirtable } from "@/lib/airtable/cliente";
import type { EsquemaCampo, EsquemaTabla } from "@/lib/airtable/construir-mapeo";
import type { Drive } from "@/lib/google/drive";
import { nombreCarpeta } from "./plan";

/** Tipos que se recrean igual; el resto queda como texto largo con su valor. */
const SIMPLES = new Set(["singleLineText", "multilineText", "email", "url", "phoneNumber", "number", "currency", "percent", "checkbox", "date", "dateTime", "singleSelect", "multipleSelects"]);

export function campoNuevo(c: EsquemaCampo, primario: boolean): CampoNuevo {
  if (primario) return { name: c.name, type: "singleLineText" };
  if (!SIMPLES.has(c.type)) return { name: c.name, type: "multilineText" };
  const o = c.options ?? {};
  switch (c.type) {
    case "number":
    case "percent":
      return { name: c.name, type: c.type, options: { precision: typeof o.precision === "number" ? o.precision : 2 } };
    case "currency":
      return { name: c.name, type: c.type, options: { precision: typeof o.precision === "number" ? o.precision : 0, symbol: typeof o.symbol === "string" ? o.symbol : "$" } };
    case "checkbox":
      return { name: c.name, type: c.type, options: { icon: "check", color: "greenBright" } };
    case "date":
      return { name: c.name, type: c.type, options: { dateFormat: { name: "iso" } } };
    case "dateTime":
      return { name: c.name, type: c.type, options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } };
    case "singleSelect":
    case "multipleSelects":
      return { name: c.name, type: c.type, options: { choices: (o.choices ?? []).map((x) => ({ name: x.name })) } };
    default:
      return { name: c.name, type: c.type };
  }
}

function texto(v: unknown, enlaces: Map<string, string>): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => texto(x, enlaces)).filter(Boolean).join("\n");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.filename === "string") {
      const enDrive = typeof o.id === "string" ? enlaces.get(o.id) : undefined;
      return enDrive ? `${o.filename} · ${enDrive}` : o.filename;
    }
    return String(o.name ?? o.label ?? JSON.stringify(o));
  }
  return String(v);
}

export function filaRestaurada(
  r: RegistroAirtable,
  esquema: EsquemaTabla,
  enlaces: Map<string, string>,
): Record<string, unknown> {
  const primario = esquema.primaryFieldId ?? esquema.fields[0]?.id;
  const fila: Record<string, unknown> = {};
  for (const c of esquema.fields) {
    const v = r.fields[c.id];
    if (v === undefined || v === null || v === "") continue;
    fila[c.name] = c.id === primario || !SIMPLES.has(c.type) ? texto(v, enlaces) : v;
  }
  return fila;
}

export interface ResultadoRestauracion {
  tabla: string;
  idTabla: string;
  filas: number;
}

/**
 * Restaura una tabla desde el respaldo de una fecha a una tabla NUEVA en la misma base.
 * Nunca escribe sobre la tabla original.
 */
export async function restaurar(
  deps: { db: Db; airtable: ClienteAirtable; drive: Drive; idUnidad: string },
  { fecha, base, tabla, idBase }: { fecha: string; base: string; tabla: string; idBase: string },
): Promise<ResultadoRestauracion> {
  const { db, airtable, drive, idUnidad } = deps;
  const dia = (await drive.carpetas(idUnidad)).find((c) => c.name === fecha);
  if (!dia) throw new Error(`No hay respaldo del ${fecha}`);
  const carpetaBase = (await drive.carpetas(dia.id)).find((c) => c.name === nombreCarpeta(base));
  if (!carpetaBase) throw new Error(`El respaldo del ${fecha} no tiene la base ${base}`);
  const archivo = await drive.archivo(`${nombreCarpeta(tabla)}.json`, carpetaBase.id);
  if (!archivo) throw new Error(`El respaldo del ${fecha} no tiene la tabla ${tabla}`);

  const datos = JSON.parse(await drive.descargarTexto(archivo)) as { esquema: EsquemaTabla; registros: RegistroAirtable[]; idBase: string };
  if (datos.idBase !== idBase) throw new Error("El respaldo es de otra base");
  const primario = datos.esquema.primaryFieldId ?? datos.esquema.fields[0]?.id;
  const ordenados = [...datos.esquema.fields].sort((a, b) => (a.id === primario ? -1 : b.id === primario ? 1 : 0));

  const idsAdjuntos = datos.registros.flatMap((r) =>
    Object.values(r.fields).flatMap((v) => (Array.isArray(v) ? v.flatMap((x) => (x && typeof x === "object" && "filename" in x && "id" in x ? [String((x as { id: unknown }).id)] : [])) : [])),
  );
  const enlaces = new Map<string, string>();
  for (let i = 0; i < idsAdjuntos.length; i += 500) {
    const filas = await db.select().from(respaldoAdjuntos).where(inArray(respaldoAdjuntos.idAdjunto, idsAdjuntos.slice(i, i + 500)));
    for (const a of filas) if (a.idDrive) enlaces.set(a.idAdjunto, `https://drive.google.com/file/d/${a.idDrive}`);
  }

  const nombre = `RESTAURADA ${fecha} · ${tabla}`.slice(0, 100);
  const nueva = await airtable.crearTabla(idBase, nombre, ordenados.map((c) => campoNuevo(c, c.id === primario)));
  const filas = await airtable.crearVarios(idBase, nueva.id, datos.registros.map((r) => filaRestaurada(r, datos.esquema, enlaces)));
  return { tabla: nombre, idTabla: nueva.id, filas };
}

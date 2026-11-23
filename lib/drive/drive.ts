import type { Sesion } from "@/lib/acceso/permisos";
import type { ClienteComposio } from "@/lib/correo/composio";
import { CUENTAS } from "@/lib/correo/cuentas";
import { nivelEnCuenta } from "@/lib/correo/redactar";

/**
 * Drive por Composio. Una sola cuenta conectada, con alias verse-drive, la de Felipe.
 * Decisión de Felipe (2026-11-23): busca y adjunta archivos todo el que envía correo desde
 * alguna cuenta. Solo lectura: la app nunca crea, mueve ni comparte archivos.
 */
export const ALIAS_DRIVE = "verse-drive";

/** Tope de los adjuntos de un correo (la herramienta de Gmail acepta 20 MiB antes de codificar). */
export const MAX_ADJUNTOS = 18 * 1024 * 1024;

export interface ArchivoDrive {
  id: string;
  nombre: string;
  tipo: string;
  modificado: string | null;
  tamano: number | null;
  enlace: string;
}

export interface Adjunto {
  name: string;
  mimetype: string;
  s3key: string;
}

export const enlaceDrive = (id: string) => `https://drive.google.com/file/d/${id}/view`;

/** Busca y adjunta quien envía desde al menos una cuenta. */
export const puedeDrive = (s: Sesion) => CUENTAS.some((c) => nivelEnCuenta(s, c.id) === "enviar");

let cache: { vence: number; id: string | null } | null = null;

/** La cuenta de Drive conectada y activa, o null. Diez minutos de memoria por instancia. */
export async function cuentaDrive(cliente: ClienteComposio, ahora = Date.now()): Promise<string | null> {
  if (cache && cache.vence > ahora) return cache.id;
  const c = (await cliente.cuentasDrive()).find((x) => x.alias === ALIAS_DRIVE && x.estado.toUpperCase() === "ACTIVE");
  cache = { vence: ahora + 10 * 60_000, id: c?.id ?? null };
  return cache.id;
}

export function olvidarDrive() {
  cache = null;
}

const CARPETA = "application/vnd.google-apps.folder";
/** Comillas y barras escapadas para la consulta de Drive. */
const literal = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export async function buscarDrive(cliente: ClienteComposio, s: Sesion, texto: string): Promise<{ archivos: ArchivoDrive[] } | { error: string }> {
  if (!puedeDrive(s)) return { error: "Buscar en Drive es para quien envía correo." };
  const cuenta = await cuentaDrive(cliente);
  if (!cuenta) return { error: `Drive no está conectado en Composio (falta la cuenta ${ALIAS_DRIVE}).` };
  const t = literal(texto.trim().slice(0, 80));
  if (t.length < 2) return { error: "Escribe al menos dos letras para buscar." };
  const r = await cliente.ejecutar("GOOGLEDRIVE_FIND_FILE", cuenta, {
    q: `(name contains '${t}' or fullText contains '${t}') and trashed = false and mimeType != '${CARPETA}'`,
    pageSize: 10,
    fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)",
  });
  const files = (r.files as { id?: string; name?: string; mimeType?: string; modifiedTime?: string; size?: string; webViewLink?: string }[] | undefined) ?? [];
  return {
    archivos: files
      .filter((f) => f.id && f.name)
      .map((f) => ({
        id: f.id!,
        nombre: f.name!,
        tipo: f.mimeType ?? "",
        modificado: f.modifiedTime?.slice(0, 10) ?? null,
        tamano: f.size ? Number(f.size) : null,
        enlace: f.webViewLink ?? enlaceDrive(f.id!),
      })),
  };
}

/**
 * Baja de Drive los archivos y los sube para la herramienta de Gmail. Lo que no se pueda
 * adjuntar (muy grande, error, Drive sin conectar) va como enlace en el texto: el correo
 * nunca se queda sin el archivo, y nunca sale un archivo distinto del que se pidió.
 */
export async function prepararAdjuntos(
  cliente: ClienteComposio,
  archivos: { id: string; nombre: string }[],
  herramientaGmail: string,
): Promise<{ adjuntos: Adjunto[]; enlaces: { nombre: string; url: string }[] }> {
  const adjuntos: Adjunto[] = [];
  const enlaces: { nombre: string; url: string }[] = [];
  const cuenta = await cuentaDrive(cliente).catch(() => null);
  let restante = MAX_ADJUNTOS;
  for (const a of archivos) {
    if (!cuenta) {
      enlaces.push({ nombre: a.nombre, url: enlaceDrive(a.id) });
      continue;
    }
    try {
      const r = await cliente.ejecutar("GOOGLEDRIVE_DOWNLOAD_FILE", cuenta, { fileId: a.id });
      const contenido = r.downloaded_file_content as { name?: string; mimetype?: string; s3url?: string } | undefined;
      if (!contenido?.s3url) throw new Error("Drive no devolvió el archivo");
      const bytes = await cliente.bajar(contenido.s3url, restante);
      const nombre = contenido.name || String(r.name ?? a.nombre);
      const mimetype = contenido.mimetype?.includes("/") ? contenido.mimetype : "application/octet-stream";
      const s3key = await cliente.subirArchivo({ toolkit: "gmail", herramienta: herramientaGmail, nombre, mimetype, bytes });
      restante -= bytes.byteLength;
      adjuntos.push({ name: nombre, mimetype, s3key });
    } catch (e) {
      console.error("[drive]", e instanceof Error ? e.message : e);
      enlaces.push({ nombre: a.nombre, url: enlaceDrive(a.id) });
    }
  }
  return { adjuntos, enlaces };
}

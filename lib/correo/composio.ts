import { createHash } from "node:crypto";

/**
 * Cliente de Composio (API REST v3.1) para las cuentas de Gmail de os-correo y el Drive.
 * Toda llamada lleva la cuenta conectada explícita: la cuenta por defecto de Composio es la
 * personal y nunca se usa (regla 5 de os-correo).
 */

const BASE = "https://backend.composio.dev/api/v3.1";

export interface CuentaConectada {
  id: string;
  alias: string | null;
  wordId: string | null;
  estado: string;
}

export interface ClienteComposio {
  ejecutar(herramienta: string, cuentaConectada: string, argumentos: Record<string, unknown>): Promise<Record<string, unknown>>;
  cuentasGmail(): Promise<CuentaConectada[]>;
  cuentasDrive(): Promise<CuentaConectada[]>;
  /** Baja un archivo que Composio dejó en su almacenamiento (s3url de una descarga). */
  bajar(url: string, maxBytes: number): Promise<Uint8Array>;
  /** Sube un archivo para pasarlo a una herramienta (adjunto de Gmail). Devuelve el s3key. */
  subirArchivo(archivo: { toolkit: string; herramienta: string; nombre: string; mimetype: string; bytes: Uint8Array }): Promise<string>;
}

/** El almacenamiento de archivos de Composio. Solo de ahí se bajan archivos. */
const ALMACEN = /^https:\/\/([a-z0-9-]+\.)*(composio\.dev|amazonaws\.com|r2\.cloudflarestorage\.com)\//;

export class ErrorComposio extends Error {
  override name = "ErrorComposio";
  constructor(
    mensaje: string,
    readonly estado?: number,
  ) {
    super(mensaje);
  }
}

/** El motivo que da Composio (ya enmascara la clave, por ejemplo "ak_**abcd"). */
async function detalle(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { error?: { message?: string; slug?: string } };
    const m = j.error?.message ?? j.error?.slug;
    return m ? `: ${m.slice(0, 160)}` : "";
  } catch {
    return "";
  }
}

export function clienteComposio(apiKey: string, fetcher: typeof fetch = fetch): ClienteComposio {
  const cabeceras = { "x-api-key": apiKey, "Content-Type": "application/json" };

  async function cuentas(toolkit: string) {
    const lista: CuentaConectada[] = [];
    let cursor: string | null = null;
    for (let pagina = 0; pagina < 5; pagina++) {
      const q = new URLSearchParams({ toolkit_slugs: toolkit, limit: "50" });
      if (cursor) q.set("cursor", cursor);
      const r = await fetcher(`${BASE}/connected_accounts?${q}`, { headers: cabeceras, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new ErrorComposio(`Composio respondió ${r.status} al listar cuentas${await detalle(r)}`, r.status);
      const j = (await r.json()) as { items?: { id: string; alias?: string | null; word_id?: string | null; status: string }[]; next_cursor?: string | null };
      for (const c of j.items ?? []) lista.push({ id: c.id, alias: c.alias ?? null, wordId: c.word_id ?? null, estado: c.status });
      cursor = j.next_cursor ?? null;
      if (!cursor) break;
    }
    return lista;
  }

  return {
    async ejecutar(herramienta, cuentaConectada, argumentos) {
      if (!cuentaConectada) throw new ErrorComposio("Falta la cuenta conectada");
      const r = await fetcher(`${BASE}/tools/execute/${encodeURIComponent(herramienta)}`, {
        method: "POST",
        headers: cabeceras,
        body: JSON.stringify({ connected_account_id: cuentaConectada, arguments: argumentos }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) throw new ErrorComposio(`Composio respondió ${r.status} en ${herramienta}${await detalle(r)}`, r.status);
      const j = (await r.json()) as { successful?: boolean; data?: Record<string, unknown>; error?: string | null };
      if (!j.successful) throw new ErrorComposio(`${herramienta} falló: ${(j.error ?? "sin detalle").slice(0, 200)}`);
      return j.data ?? {};
    },

    cuentasGmail: () => cuentas("gmail"),
    cuentasDrive: () => cuentas("googledrive"),

    async bajar(url, maxBytes) {
      if (!ALMACEN.test(url)) throw new ErrorComposio("El archivo no viene del almacenamiento de Composio");
      const r = await fetcher(url, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new ErrorComposio(`No se pudo bajar el archivo (${r.status})`, r.status);
      const largo = Number(r.headers.get("content-length") ?? 0);
      if (largo > maxBytes) throw new ErrorComposio("El archivo es muy grande para adjuntarlo");
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.byteLength > maxBytes) throw new ErrorComposio("El archivo es muy grande para adjuntarlo");
      return bytes;
    },

    async subirArchivo({ toolkit, herramienta, nombre, mimetype, bytes }) {
      const md5 = createHash("md5").update(bytes).digest("hex");
      const r = await fetcher(`${BASE}/files/upload/request`, {
        method: "POST",
        headers: cabeceras,
        body: JSON.stringify({ toolkit_slug: toolkit, tool_slug: herramienta, filename: nombre, mimetype, md5 }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) throw new ErrorComposio(`Composio respondió ${r.status} al pedir la subida`, r.status);
      const j = (await r.json()) as { key?: string; new_presigned_url?: string; newPresignedUrl?: string };
      const destino = j.new_presigned_url ?? j.newPresignedUrl;
      if (!j.key || !destino) throw new ErrorComposio("Composio no devolvió dónde subir el archivo");
      const put = await fetcher(destino, { method: "PUT", headers: { "Content-Type": mimetype }, body: bytes as BodyInit, signal: AbortSignal.timeout(60_000) });
      if (!put.ok) throw new ErrorComposio(`La subida del archivo falló (${put.status})`, put.status);
      return j.key;
    },
  };
}

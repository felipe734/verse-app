import { ErrorGoogle } from "./acceso";

const API = "https://www.googleapis.com/drive/v3";
const SUBIDA = "https://www.googleapis.com/upload/drive/v3";
const CARPETA = "application/vnd.google-apps.folder";

export interface ArchivoDrive {
  id: string;
  name: string;
}

/** Lo que el respaldo usa de Drive, siempre dentro de una unidad compartida. */
export interface Drive {
  carpeta(nombre: string, padre: string): Promise<string>;
  carpetas(padre: string): Promise<ArchivoDrive[]>;
  subir(nombre: string, padre: string, contenido: Uint8Array | string, tipo: string): Promise<string>;
  /** Sube un archivo grande por flujo, sin cargarlo en memoria. */
  subirFlujo(nombre: string, padre: string, flujo: ReadableStream<Uint8Array>, tipo: string, bytes?: number): Promise<string>;
  aPapelera(id: string): Promise<void>;
}

const comillas = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export function crearDrive({
  token,
  idUnidad,
  fetch: f = fetch,
}: {
  token: () => Promise<string>;
  idUnidad: string;
  fetch?: typeof fetch;
}): Drive {
  async function pedir(url: string, init: RequestInit = {}): Promise<Response> {
    const r = await f(url, { ...init, headers: { Authorization: `Bearer ${await token()}`, ...init.headers } });
    if (!r.ok) throw new ErrorGoogle(`Drive respondió ${r.status} en ${new URL(url).pathname}`, r.status);
    return r;
  }

  const enUnidad = `supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${idUnidad}`;

  async function listarCarpetas(padre: string, nombre?: string): Promise<ArchivoDrive[]> {
    const filtro = [`'${comillas(padre)}' in parents`, `mimeType='${CARPETA}'`, "trashed=false"];
    if (nombre) filtro.push(`name='${comillas(nombre)}'`);
    const todos: ArchivoDrive[] = [];
    let pagina: string | undefined;
    do {
      const q = new URLSearchParams({ q: filtro.join(" and "), fields: "nextPageToken,files(id,name)", pageSize: "1000" });
      if (pagina) q.set("pageToken", pagina);
      const r = (await (await pedir(`${API}/files?${q}&${enUnidad}`)).json()) as { files: ArchivoDrive[]; nextPageToken?: string };
      todos.push(...r.files);
      pagina = r.nextPageToken;
    } while (pagina);
    return todos;
  }

  async function abrirSesion(nombre: string, padre: string, tipo: string, bytes?: number): Promise<string> {
    const inicio = await pedir(`${SUBIDA}/files?uploadType=resumable&supportsAllDrives=true&fields=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": tipo,
        ...(bytes ? { "X-Upload-Content-Length": String(bytes) } : {}),
      },
      body: JSON.stringify({ name: nombre, parents: [padre] }),
    });
    const ubicacion = inicio.headers.get("location");
    if (!ubicacion) throw new ErrorGoogle("Drive no devolvió la URL de subida", 500);
    return ubicacion;
  }

  return {
    carpetas: (padre) => listarCarpetas(padre),

    async subirFlujo(nombre, padre, flujo, tipo, bytes) {
      const ubicacion = await abrirSesion(nombre, padre, tipo, bytes);
      const r = await f(ubicacion, {
        method: "PUT",
        headers: { "Content-Type": tipo },
        body: flujo,
        duplex: "half",
      } as RequestInit);
      if (!r.ok) throw new ErrorGoogle(`Drive respondió ${r.status} al subir ${nombre}`, r.status);
      return ((await r.json()) as { id: string }).id;
    },

    async carpeta(nombre, padre) {
      const [existe] = await listarCarpetas(padre, nombre);
      if (existe) return existe.id;
      const r = await pedir(`${API}/files?supportsAllDrives=true&fields=id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nombre, mimeType: CARPETA, parents: [padre] }),
      });
      return ((await r.json()) as { id: string }).id;
    },

    async subir(nombre, padre, contenido, tipo) {
      const ubicacion = await abrirSesion(nombre, padre, tipo);
      const cuerpo = typeof contenido === "string" ? new TextEncoder().encode(contenido) : contenido;
      const r = await f(ubicacion, { method: "PUT", headers: { "Content-Type": tipo }, body: new Blob([cuerpo as Uint8Array<ArrayBuffer>]) });
      if (!r.ok) throw new ErrorGoogle(`Drive respondió ${r.status} al subir ${nombre}`, r.status);
      return ((await r.json()) as { id: string }).id;
    },

    async aPapelera(id) {
      await pedir(`${API}/files/${id}?supportsAllDrives=true`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
    },
  };
}

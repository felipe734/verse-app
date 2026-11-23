import type { EsquemaTabla } from "./construir-mapeo";

const API = "https://api.airtable.com/v0";

export interface RegistroAirtable {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface OpcionesCliente {
  token: string;
  fetch?: typeof fetch;
  /** Se llama una vez por cada llamada HTTP a Airtable (medición por workspace). */
  alLlamar?: (idBase: string) => void;
}

export class ErrorAirtable extends Error {
  override name = "ErrorAirtable";
  constructor(
    mensaje: string,
    readonly estado: number,
  ) {
    super(mensaje);
  }
}

export function crearCliente({ token, fetch: f = fetch, alLlamar }: OpcionesCliente) {
  async function pedir<T>(idBase: string, ruta: string, init?: RequestInit): Promise<T> {
    alLlamar?.(idBase);
    const respuesta = await f(`${API}${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!respuesta.ok) {
      // Nunca se registra el token ni el cuerpo de la petición.
      throw new ErrorAirtable(`Airtable respondió ${respuesta.status} en ${ruta.split("?")[0]}`, respuesta.status);
    }
    return (await respuesta.json()) as T;
  }

  return {
    pedir,

    async esquema(idBase: string): Promise<EsquemaTabla[]> {
      const r = await pedir<{ tables: EsquemaTabla[] }>(idBase, `/meta/bases/${idBase}/tables`);
      return r.tables;
    },

    /** Todas las filas de una tabla, con campos por ID. */
    async todos(idBase: string, idTabla: string, params: Record<string, string> = {}) {
      const filas: RegistroAirtable[] = [];
      let offset: string | undefined;
      do {
        const q = new URLSearchParams({ pageSize: "100", returnFieldsByFieldId: "true", ...params });
        if (offset) q.set("offset", offset);
        const r = await pedir<{ records: RegistroAirtable[]; offset?: string }>(
          idBase,
          `/${idBase}/${idTabla}?${q.toString()}`,
        );
        filas.push(...r.records);
        offset = r.offset;
      } while (offset);
      return filas;
    },
  };
}

export type ClienteAirtable = ReturnType<typeof crearCliente>;

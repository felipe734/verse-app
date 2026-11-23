import type { EsquemaTabla } from "./construir-mapeo";

const API = "https://api.airtable.com/v0";

export interface RegistroAirtable {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface PayloadWebhook {
  timestamp: string;
  changedTablesById?: Record<
    string,
    {
      createdRecordsById?: Record<string, unknown>;
      changedRecordsById?: Record<string, unknown>;
      destroyedRecordIds?: string[];
    }
  >;
}

export interface WebhookCreado {
  id: string;
  macSecretBase64: string;
  expirationTime: string;
}

/** Lo que la app usa de Airtable. Las pruebas pasan una versión falsa. */
export interface ClienteAirtable {
  esquema(idBase: string): Promise<EsquemaTabla[]>;
  todos(idBase: string, idTabla: string): Promise<RegistroAirtable[]>;
  porIds(idBase: string, idTabla: string, recIds: string[]): Promise<RegistroAirtable[]>;
  obtener(idBase: string, idTabla: string, recId: string): Promise<RegistroAirtable | null>;
  actualizar(idBase: string, idTabla: string, recId: string, campos: Record<string, unknown>): Promise<RegistroAirtable>;
  crear(idBase: string, idTabla: string, campos: Record<string, unknown>): Promise<RegistroAirtable>;
  crearWebhook(idBase: string, idTabla: string, url: string): Promise<WebhookCreado>;
  renovarWebhook(idBase: string, webhookId: string): Promise<{ expirationTime: string }>;
  payloads(
    idBase: string,
    webhookId: string,
    cursor: number,
  ): Promise<{ payloads: PayloadWebhook[]; cursor: number; mightHaveMore: boolean }>;
}

export interface OpcionesCliente {
  token: string;
  fetch?: typeof fetch;
  /** Se llama una vez por cada llamada HTTP a Airtable (medición por workspace). */
  alLlamar?: (idBase: string) => void;
  /** Espera mínima entre llamadas a una misma base. Airtable permite 5 por segundo. */
  msEntreLlamadas?: number;
}

export class ErrorAirtable extends Error {
  override name = "ErrorAirtable";
  constructor(
    mensaje: string,
    readonly estado: number,
  ) {
    super(mensaje);
  }
  get reintentable(): boolean {
    return this.estado === 429 || this.estado >= 500;
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function crearCliente({
  token,
  fetch: f = fetch,
  alLlamar,
  msEntreLlamadas = 220,
}: OpcionesCliente): ClienteAirtable {
  const ultimaPorBase = new Map<string, number>();

  async function pedir<T>(idBase: string, ruta: string, init?: RequestInit): Promise<T> {
    const ultima = ultimaPorBase.get(idBase) ?? 0;
    const espera = ultima + msEntreLlamadas - Date.now();
    if (espera > 0) await esperar(espera);
    ultimaPorBase.set(idBase, Date.now());
    alLlamar?.(idBase);

    const respuesta = await f(`${API}${ruta}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    });
    if (!respuesta.ok) {
      // Nunca se registra el token ni el cuerpo de la petición.
      throw new ErrorAirtable(`Airtable respondió ${respuesta.status} en ${ruta.split("?")[0]}`, respuesta.status);
    }
    return (await respuesta.json()) as T;
  }

  async function listar(idBase: string, idTabla: string, extra: Record<string, string> = {}) {
    const filas: RegistroAirtable[] = [];
    let offset: string | undefined;
    do {
      const q = new URLSearchParams({ pageSize: "100", returnFieldsByFieldId: "true", ...extra });
      if (offset) q.set("offset", offset);
      const r = await pedir<{ records: RegistroAirtable[]; offset?: string }>(idBase, `/${idBase}/${idTabla}?${q}`);
      filas.push(...r.records);
      offset = r.offset;
    } while (offset);
    return filas;
  }

  return {
    async esquema(idBase) {
      return (await pedir<{ tables: EsquemaTabla[] }>(idBase, `/meta/bases/${idBase}/tables`)).tables;
    },
    todos: (idBase, idTabla) => listar(idBase, idTabla),
    async porIds(idBase, idTabla, recIds) {
      const filas: RegistroAirtable[] = [];
      for (let i = 0; i < recIds.length; i += 50) {
        const grupo = recIds.slice(i, i + 50).filter((id) => /^rec[A-Za-z0-9]{14}$/.test(id));
        if (grupo.length === 0) continue;
        const formula = `OR(${grupo.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
        filas.push(...(await listar(idBase, idTabla, { filterByFormula: formula })));
      }
      return filas;
    },
    async obtener(idBase, idTabla, recId) {
      try {
        return await pedir<RegistroAirtable>(idBase, `/${idBase}/${idTabla}/${recId}?returnFieldsByFieldId=true`);
      } catch (e) {
        if (e instanceof ErrorAirtable && e.estado === 404) return null;
        throw e;
      }
    },
    actualizar: (idBase, idTabla, recId, campos) =>
      pedir<RegistroAirtable>(idBase, `/${idBase}/${idTabla}/${recId}?returnFieldsByFieldId=true`, {
        method: "PATCH",
        body: JSON.stringify({ fields: campos, returnFieldsByFieldId: true }),
      }),
    crear: (idBase, idTabla, campos) =>
      pedir<RegistroAirtable>(idBase, `/${idBase}/${idTabla}`, {
        method: "POST",
        body: JSON.stringify({ fields: campos, returnFieldsByFieldId: true }),
      }),
    crearWebhook: (idBase, idTabla, url) =>
      pedir<WebhookCreado>(idBase, `/bases/${idBase}/webhooks`, {
        method: "POST",
        body: JSON.stringify({
          notificationUrl: url,
          specification: { options: { filters: { dataTypes: ["tableData"], recordChangeScope: idTabla } } },
        }),
      }),
    renovarWebhook: (idBase, webhookId) =>
      pedir<{ expirationTime: string }>(idBase, `/bases/${idBase}/webhooks/${webhookId}/refresh`, { method: "POST" }),
    payloads: (idBase, webhookId, cursor) =>
      pedir(idBase, `/bases/${idBase}/webhooks/${webhookId}/payloads?cursor=${cursor}`),
  };
}

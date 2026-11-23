/**
 * Cliente de Composio (API REST v3.1) para las cuentas de Gmail de os-correo.
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
}

export class ErrorComposio extends Error {
  override name = "ErrorComposio";
  constructor(
    mensaje: string,
    readonly estado?: number,
  ) {
    super(mensaje);
  }
}

export function clienteComposio(apiKey: string, fetcher: typeof fetch = fetch): ClienteComposio {
  const cabeceras = { "x-api-key": apiKey, "Content-Type": "application/json" };

  return {
    async ejecutar(herramienta, cuentaConectada, argumentos) {
      if (!cuentaConectada) throw new ErrorComposio("Falta la cuenta conectada");
      const r = await fetcher(`${BASE}/tools/execute/${encodeURIComponent(herramienta)}`, {
        method: "POST",
        headers: cabeceras,
        body: JSON.stringify({ connected_account_id: cuentaConectada, arguments: argumentos }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) throw new ErrorComposio(`Composio respondió ${r.status} en ${herramienta}`, r.status);
      const j = (await r.json()) as { successful?: boolean; data?: Record<string, unknown>; error?: string | null };
      if (!j.successful) throw new ErrorComposio(`${herramienta} falló: ${(j.error ?? "sin detalle").slice(0, 200)}`);
      return j.data ?? {};
    },

    async cuentasGmail() {
      const cuentas: CuentaConectada[] = [];
      let cursor: string | null = null;
      for (let pagina = 0; pagina < 5; pagina++) {
        const q = new URLSearchParams({ "toolkit_slugs": "gmail", limit: "50" });
        if (cursor) q.set("cursor", cursor);
        const r = await fetcher(`${BASE}/connected_accounts?${q}`, { headers: cabeceras, signal: AbortSignal.timeout(15_000) });
        if (!r.ok) throw new ErrorComposio(`Composio respondió ${r.status} al listar cuentas`, r.status);
        const j = (await r.json()) as { items?: { id: string; alias?: string | null; word_id?: string | null; status: string }[]; next_cursor?: string | null };
        for (const c of j.items ?? []) cuentas.push({ id: c.id, alias: c.alias ?? null, wordId: c.word_id ?? null, estado: c.status });
        cursor = j.next_cursor ?? null;
        if (!cursor) break;
      }
      return cuentas;
    },
  };
}

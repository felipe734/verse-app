import { createHash } from "node:crypto";

/**
 * Auco dentro de Verse App (rediseño R7, reemplaza a verse-docs para los contratos que genera la
 * app). Mismas llaves y misma API que usaba verse-docs. Las llaves viven solo en Vercel.
 */

export interface Respuesta {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

export type LlamarAuco = (ruta: string, opciones?: { method?: string; body?: unknown; privada?: boolean }) => Promise<Respuesta>;

export const aucoConfigurado = () => Boolean(process.env.AUCO_PUK && process.env.AUCO_PRK && process.env.FIRMANTE_CELULAR);

export function llamarAuco(): LlamarAuco | null {
  if (!aucoConfigurado()) return null;
  const base = process.env.AUCO_ENV === "prod" ? "https://api.auco.ai/v1.5/ext" : "https://dev.auco.ai/v1.5/ext";
  return async (ruta, { method = "GET", body, privada = false } = {}) => {
    const r = await fetch(`${base}${ruta}`, {
      method,
      headers: { Authorization: (privada ? process.env.AUCO_PRK : process.env.AUCO_PUK)!, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const texto = await r.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(texto) as Record<string, unknown>;
    } catch {
      data = { raw: texto.slice(0, 500) };
    }
    return { ok: r.ok, status: r.status, data };
  };
}

/** Valor del encabezado que Auco manda en cada aviso; sale de la llave privada, sin otra variable. */
export function secretoWebhook(): string | null {
  const prk = process.env.AUCO_PRK;
  return prk ? createHash("sha256").update(`${prk}|verse-app-webhook`).digest("hex") : null;
}

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

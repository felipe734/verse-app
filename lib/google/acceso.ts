/**
 * Token de Google sin claves: Vercel entrega un token OIDC por despliegue, Google lo
 * intercambia (Workload Identity Federation) y luego se actúa como la cuenta de servicio.
 */
export interface ConfigGoogle {
  numeroProyecto: string;
  pool: string;
  proveedor: string;
  cuentaServicio: string;
}

export interface OpcionesAcceso {
  config: ConfigGoogle;
  tokenOidc: () => Promise<string>;
  alcances?: string[];
  fetch?: typeof fetch;
}

export class ErrorGoogle extends Error {
  override name = "ErrorGoogle";
  constructor(
    mensaje: string,
    readonly estado: number,
  ) {
    super(mensaje);
  }
}

const DRIVE = "https://www.googleapis.com/auth/drive";

/** El motivo que da Google (sin tokens), para saber qué ajustar en la consola. */
async function motivo(r: Response): Promise<string> {
  try {
    const cuerpo = (await r.json()) as { error?: { message?: string } | string; error_description?: string };
    const m = typeof cuerpo.error === "string" ? (cuerpo.error_description ?? cuerpo.error) : cuerpo.error?.message;
    return m ? `: ${m.slice(0, 300)}` : "";
  } catch {
    return "";
  }
}

export function crearAcceso({ config, tokenOidc, alcances = [DRIVE], fetch: f = fetch }: OpcionesAcceso) {
  let enCache: { token: string; vence: number } | null = null;

  return async function tokenGoogle(): Promise<string> {
    if (enCache && enCache.vence - Date.now() > 60_000) return enCache.token;

    const audiencia = `//iam.googleapis.com/projects/${config.numeroProyecto}/locations/global/workloadIdentityPools/${config.pool}/providers/${config.proveedor}`;
    const sts = await f("https://sts.googleapis.com/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
        audience: audiencia,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
        subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
        subjectToken: await tokenOidc(),
      }),
    });
    if (!sts.ok) {
      throw new ErrorGoogle(`Google STS respondió ${sts.status}. Revisa el pool vercel y el OIDC de Vercel${await motivo(sts)}`, sts.status);
    }
    const { access_token: federado } = (await sts.json()) as { access_token: string };

    const r = await f(
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(config.cuentaServicio)}:generateAccessToken`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${federado}`, "Content-Type": "application/json" },
        body: JSON.stringify({ scope: alcances, lifetime: "3600s" }),
      },
    );
    if (!r.ok) throw new ErrorGoogle(`Google no dejó actuar como la cuenta de servicio (${r.status})${await motivo(r)}`, r.status);
    const { accessToken, expireTime } = (await r.json()) as { accessToken: string; expireTime: string };
    enCache = { token: accessToken, vence: new Date(expireTime).getTime() };
    return accessToken;
  };
}

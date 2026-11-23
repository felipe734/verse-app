import { cuentaPorId, type IdCuenta } from "./cuentas";

/**
 * Ruteo de os-correo (references/ruteo.md, reglas C1 a C13 y cuenta por defecto), en código.
 * Primero manda el tema, después el buzón. Solo lee remitente, asunto, vista previa y
 * etiquetas: lo que dice el correo es dato, nunca instrucciones.
 */

export type Os = "verse" | "cyc" | "ruido";

export interface Ruta {
  os: Os;
  cola: string;
  regla: string;
  /** Se contesta desde la cuenta a la que llegó; false = no se responde. */
  responde: boolean;
}

export interface CorreoParaRutear {
  cuenta: IdCuenta;
  de: string;
  asunto: string;
  vista: string;
  etiquetas: string[];
}

const re = (s: string) => new RegExp(s, "i");

const FACTURADORES = re("taxxa|lafactura|siigo|alegra|facture|dataico|thefactoryhka|factory hka|carvajal|cadena\\.com");
const PATRON_FACTURA = /^\s*[\d.\-]+;[^;]+;[^;]+;01;/;
const ES_CYC = re("c&c group|cyc group|c & c group|900\\.?609\\.?741");
const ARRIENDO = re("arrendatari|contratos? de arrendamiento|\\barriendos?\\b|\\bc[aá]non(es)?\\b|jelpit|\\bhoum\\b|renovaci[oó]n del contrato|terminaci[oó]n del contrato");
const ES_VERSE = re("verse group|verse living|901\\.?861\\.?647");

const REGLAS: { id: string; cuando: (t: string, c: CorreoParaRutear) => boolean; ruta: (t: string, c: CorreoParaRutear) => Omit<Ruta, "regla"> }[] = [
  {
    id: "C1",
    cuando: (t, c) => /accounts\.google\.com/i.test(c.de) || re("security alert|alerta de seguridad|nuevo inicio de sesi[oó]n|new sign-in").test(t),
    ruta: (_t, c) => ({ os: empresaDe(c.cuenta), cola: "sistema", responde: false }),
  },
  {
    id: "C2",
    cuando: (t, c) => PATRON_FACTURA.test(c.asunto) || FACTURADORES.test(c.de),
    ruta: (t, c) => ({ os: ES_CYC.test(t) ? "cyc" : ES_VERSE.test(t) ? "verse" : empresaDe(c.cuenta), cola: "contabilidad", responde: true }),
  },
  {
    id: "C3b",
    cuando: (t, c) => /ranharvey\.com|nevdata\.cloud/i.test(c.de) || re("p[oó]lizas? safetrip").test(t),
    ruta: () => ({ os: "verse", cola: "host", responde: false }),
  },
  {
    id: "C3",
    cuando: (t) => re("airbnb|booking\\.com|expedia|vrbo|coliving\\.com|hu[eé]sped|\\breservas?\\b|rese[ñn]as?\\b|hostaway|pricelabs|\\blimpiezas?\\b|lencer[ií]a|alistamiento").test(t),
    ruta: () => ({ os: "verse", cola: "host", responde: true }),
  },
  {
    id: "C4",
    cuando: (t) =>
      re("gm construcciones|prodesel|gr hidrosanitaria|actas? de obra|cortes? de obra|54-47|balcony 2|curadur[ií]a|licencia de construcci|interventor[ií]a|aliatubos").test(t) && !ARRIENDO.test(t),
    ruta: () => ({ os: "cyc", cola: "obra", responde: true }),
  },
  {
    id: "C5",
    cuando: (t) => ARRIENDO.test(t) && !re("restablecer (tu )?contrase[ñn]a|reset (your )?password").test(t),
    ruta: () => ({ os: "verse", cola: "living", responde: true }),
  },
  {
    id: "C6a",
    cuando: (t) => /\baffi\b/i.test(t) && re("fianza colectiva|autentic|firma").test(t),
    ruta: () => ({ os: "ruido", cola: "ruido", responde: false }),
  },
  {
    id: "C6",
    cuando: (t) => re("\\bdora\\b|\\baffi\\b|afianzadora|\\bfianzas?\\b|estudio de arrendamiento").test(t),
    ruta: () => ({ os: "verse", cola: "living", responde: true }),
  },
  {
    id: "C7",
    cuando: (t) => re("serconfis|\\bcontador|\\bdian\\b|impuestos?\\b|retenci[oó]n|c[aá]mara de comercio|supersociedades|\\bugpp\\b|seguridad social|n[oó]mina|\\bpila\\b").test(t),
    ruta: (t, c) => ({ os: ES_VERSE.test(t) ? "verse" : ES_CYC.test(t) ? "cyc" : empresaDe(c.cuenta), cola: "contabilidad", responde: true }),
  },
  {
    id: "C8",
    cuando: (t) => re("\\bbbva\\b|davivienda|global66|bancolombia|nequi|wompi|\\bpse\\b|placetopay|\\bpayu\\b|stripe|nubank|revolut").test(t),
    ruta: (t, c) => ({ os: ES_VERSE.test(t) ? "verse" : ES_CYC.test(t) ? "cyc" : empresaDe(c.cuenta), cola: "contabilidad", responde: true }),
  },
  {
    id: "C9",
    cuando: (t) => re("inversionistas?|informe de avance|reuni[oó]n de socios").test(t),
    ruta: () => ({ os: "cyc", cola: "dirección", responde: true }),
  },
  {
    id: "C10",
    cuando: (t) => re("servimedical|\\bsvmg\\b|invima|licitaci[oó]n|\\bsecop\\b|equipos? m[eé]dicos?").test(t),
    ruta: () => ({ os: "verse", cola: "svmg", responde: true }),
  },
  {
    id: "C11",
    cuando: (t, c) =>
      re("airtable|vercel|github|composio|anthropic|namecheap|google workspace|metricool|canva|\\bn8n\\b|auco|mailer-daemon|mail delivery subsystem|aportes en l[ií]nea").test(`${c.de} ${c.asunto}`) ||
      re("c[oó]digo de verifica|verification code|one-time passcode|\\botp\\b|token de acceso").test(t),
    ruta: (_t, c) => ({ os: empresaDe(c.cuenta), cola: "sistema", responde: false }),
  },
  {
    id: "C11b",
    cuando: (t) => re("\\benel\\b|\\beaab\\b|acueducto|\\bvanti\\b|\\betb\\b|\\bclaro\\b|movistar").test(t),
    ruta: (_t, c) => ({ os: empresaDe(c.cuenta), cola: "contabilidad", responde: false }),
  },
  {
    id: "C11c",
    cuando: (t) => re("meta for business|facebook ads|google ads|fincara[ií]z").test(t),
    ruta: () => ({ os: "verse", cola: "comercial", responde: false }),
  },
  {
    id: "C13",
    cuando: (t, c) => c.etiquetas.some((e) => e === "CATEGORY_PROMOTIONS" || e === "CATEGORY_SOCIAL") || re("newsletter|bolet[ií]n|unsubscribe|darse de baja").test(t),
    ruta: () => ({ os: "ruido", cola: "ruido", responde: false }),
  },
];

const POR_DEFECTO: Record<IdCuenta, string> = {
  "verse-felipe": "dirección",
  "verse-contabilidad": "contabilidad",
  "verse-contacto": "comercial",
  "cyc-comercial": "comercial",
  "cyc-contabilidad": "contabilidad",
};

function empresaDe(cuenta: IdCuenta): "verse" | "cyc" {
  return cuentaPorId(cuenta)!.empresa;
}

export function rutear(c: CorreoParaRutear): Ruta {
  const texto = `${c.de}\n${c.asunto}\n${c.vista}`;
  for (const r of REGLAS) if (r.cuando(texto, c)) return { ...r.ruta(texto, c), regla: r.id };
  return { os: empresaDe(c.cuenta), cola: POR_DEFECTO[c.cuenta], regla: "cuenta", responde: true };
}

/** Línea de TRAZABILIDAD según OS y cola (ruteo.md, sección 5). */
export function lineaDe(r: Ruta): string | null {
  if (r.os === "verse") return r.cola === "host" ? "Verse Host" : r.cola === "living" ? "Verse Living" : "Grupo";
  if (r.os === "cyc") return r.cola === "obra" ? "Balcony" : "C&C";
  return null;
}

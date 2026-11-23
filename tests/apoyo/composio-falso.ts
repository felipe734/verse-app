import type { ClienteComposio, CuentaConectada } from "@/lib/correo/composio";

/** Composio en memoria. Correos inventados, nunca reales. */
export class ComposioFalso implements ClienteComposio {
  conectadas: CuentaConectada[] = [
    { id: "ca_felipe", alias: "verse-felipe", wordId: "gmail_tarn-wait", estado: "ACTIVE" },
    { id: "ca_conta", alias: "verse-contabilidad", wordId: "gmail_twelve-ovally", estado: "ACTIVE" },
    { id: "ca_contacto", alias: null, wordId: "gmail_anon-erbia", estado: "ACTIVE" },
    { id: "ca_cyc", alias: "cyc-comercial", wordId: "gmail_vetch-hummer", estado: "ACTIVE" },
    { id: "ca_personal", alias: "felipe-personal", wordId: "gmail_codist-plass", estado: "ACTIVE" },
  ];
  /** Mensajes por cuenta conectada. */
  buzones = new Map<string, Record<string, unknown>[]>();
  hilos = new Map<string, Record<string, unknown>[]>();
  /** Enviados por cuenta conectada, para la revisión de duplicados. */
  enviados = new Map<string, Record<string, unknown>[]>();
  llamadas: { herramienta: string; cuenta: string; argumentos: Record<string, unknown> }[] = [];
  fallaEn: string | null = null;

  async cuentasGmail() {
    return this.conectadas;
  }

  async ejecutar(herramienta: string, cuenta: string, argumentos: Record<string, unknown>) {
    this.llamadas.push({ herramienta, cuenta, argumentos });
    if (this.fallaEn === cuenta) throw new Error("Composio respondió 500");
    if (herramienta === "GMAIL_FETCH_EMAILS") return { messages: (/(^|\s)in:sent/.test(String(argumentos.query)) ? this.enviados : this.buzones).get(cuenta) ?? [] };
    if (herramienta === "GMAIL_FETCH_MESSAGE_BY_THREAD_ID") return { messages: this.hilos.get(String(argumentos.thread_id)) ?? [] };
    return {};
  }
}

let n = 0;
export function mensaje(campos: { de: string; asunto: string; vista?: string; hace?: number; etiquetas?: string[]; hilo?: string }) {
  const id = (0x1a2000000000000 + ++n).toString(16);
  return {
    messageId: id,
    threadId: campos.hilo ?? id,
    sender: campos.de,
    subject: campos.asunto,
    messageTimestamp: new Date(Date.now() - (campos.hace ?? 1) * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z"),
    labelIds: campos.etiquetas ?? ["INBOX"],
    attachmentList: [],
    preview: { body: campos.vista ?? "", subject: campos.asunto },
  };
}

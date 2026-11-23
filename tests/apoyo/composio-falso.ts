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
  drive: CuentaConectada[] = [{ id: "ca_drive", alias: "verse-drive", wordId: "googledrive_x", estado: "ACTIVE" }];
  /** Archivos de Drive por id. */
  archivos = new Map<string, { name: string; mimeType: string; bytes: number }>();
  subidos: { toolkit: string; herramienta: string; nombre: string; mimetype: string; largo: number }[] = [];
  fallaSubida = false;

  async cuentasGmail() {
    return this.conectadas;
  }

  async cuentasDrive() {
    return this.drive;
  }

  async bajar(url: string, maxBytes: number) {
    const f = this.archivos.get(url.replace("https://almacen.composio.dev/", ""));
    if (!f) throw new Error("no existe");
    if (f.bytes > maxBytes) throw new Error("El archivo es muy grande para adjuntarlo");
    return new Uint8Array(f.bytes);
  }

  async subirArchivo(a: { toolkit: string; herramienta: string; nombre: string; mimetype: string; bytes: Uint8Array }) {
    if (this.fallaSubida) throw new Error("subida falló");
    this.subidos.push({ toolkit: a.toolkit, herramienta: a.herramienta, nombre: a.nombre, mimetype: a.mimetype, largo: a.bytes.byteLength });
    return `subidos/${a.nombre}`;
  }

  async ejecutar(herramienta: string, cuenta: string, argumentos: Record<string, unknown>) {
    this.llamadas.push({ herramienta, cuenta, argumentos });
    if (this.fallaEn === cuenta) throw new Error("Composio respondió 500");
    if (herramienta === "GMAIL_FETCH_EMAILS") return { messages: (/(^|\s)in:sent/.test(String(argumentos.query)) ? this.enviados : this.buzones).get(cuenta) ?? [] };
    if (herramienta === "GOOGLEDRIVE_FIND_FILE")
      return { files: [...this.archivos].map(([id, f]) => ({ id, name: f.name, mimeType: f.mimeType, modifiedTime: "2026-11-20T10:00:00Z", size: String(f.bytes) })) };
    if (herramienta === "GOOGLEDRIVE_DOWNLOAD_FILE") {
      const f = this.archivos.get(String(argumentos.fileId));
      if (!f) throw new Error("GOOGLEDRIVE_DOWNLOAD_FILE falló: not found");
      return { id: argumentos.fileId, name: f.name, mimeType: f.mimeType, downloaded_file_content: { name: f.name, mimetype: f.mimeType, s3url: `https://almacen.composio.dev/${String(argumentos.fileId)}` } };
    }
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

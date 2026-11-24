import type { ClienteComposio } from "@/lib/correo/composio";

/** Correo inventado para la vitrina de Playwright. Ningún dato real. */
export function composioVitrina(): ClienteComposio {
  const hace = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");
  const m = (id: string, de: string, asunto: string, vista: string, h: number, etiquetas = ["INBOX", "UNREAD"]) => ({
    messageId: id,
    threadId: id,
    sender: de,
    subject: asunto,
    messageTimestamp: hace(h),
    labelIds: etiquetas,
    attachmentList: [],
    preview: { body: vista, subject: asunto },
    messageText: `${vista}\n\nQuedo atento.\n\nUn saludo.`,
    to: "",
  });
  const buzones: Record<string, ReturnType<typeof m>[]> = {
    ca_felipe: [
      m("1a2000000000a01", "Administración Torre Norte <admin@ejemplo.test>", "Estado de cuenta de noviembre", "Adjuntamos el estado de cuenta de la unidad 603 con corte al 20 de noviembre.", 2),
      m("1a2000000000a02", "Airbnb <automated@airbnb.example>", "Reserva confirmada para Torre Norte 603", "Tienes una nueva reserva del 26 al 29 de noviembre.", 5, ["INBOX"]),
    ],
    ca_contacto: [m("1a2000000000a03", "Propietario interesado <lead@ejemplo.test>", "Quiero poner mi apartamento en arriendo", "Hola, tengo un apartamento en Chapinero y quiero saber cómo funciona el servicio.", 9)],
    ca_conta: [m("1a2000000000a04", "Facturación <facturas@proveedor.example>", "900123456;Proveedor SAS;FE-881;01;Proveedor SAS", "Estimado VERSE GROUP SAS, adjuntamos la factura electrónica FE-881.", 20, ["INBOX"])],
    ca_cyc: [m("1a2000000000a05", "Contratista de mampostería <obra@ejemplo.test>", "Acta de corte 7", "Envío las cantidades del corte 7 para su revisión.", 3)],
  };
  const conectadas = [
    { id: "ca_felipe", alias: "verse-felipe", wordId: "gmail_tarn-wait", estado: "ACTIVE" },
    { id: "ca_conta", alias: "verse-contabilidad", wordId: "gmail_twelve-ovally", estado: "ACTIVE" },
    { id: "ca_contacto", alias: "verse-contacto", wordId: "gmail_anon-erbia", estado: "ACTIVE" },
    { id: "ca_cyc", alias: "cyc-comercial", wordId: "gmail_vetch-hummer", estado: "ACTIVE" },
    { id: "ca_cyc_conta", alias: "cyc-contabilidad", wordId: "gmail_fender-sumph", estado: "ACTIVE" },
  ];
  const archivos = [
    { id: "1vitrinaPolizaTorreNorte603", name: "Póliza Torre Norte 603.pdf", mimeType: "application/pdf", modifiedTime: hace(30), size: "182044" },
    { id: "1vitrinaEstadoCuentaNoviembre", name: "Estado de cuenta noviembre.pdf", mimeType: "application/pdf", modifiedTime: hace(50), size: "90211" },
  ];
  return {
    async cuentasGmail() {
      return conectadas;
    },
    async cuentasDrive() {
      return [{ id: "ca_drive", alias: "verse-drive", wordId: "googledrive_vitrina", estado: "ACTIVE" }];
    },
    async bajar() {
      return new Uint8Array(8);
    },
    async conectar(_toolkit, alias, volver) {
      return `${volver}${volver.includes("?") ? "&" : "?"}conectada=${alias}`;
    },
    async quitar() {},
    async subirArchivo(a) {
      return `vitrina/${a.nombre}`;
    },
    async ejecutar(herramienta, cuenta, args) {
      if (herramienta === "GOOGLEDRIVE_FIND_FILE") {
        const t = String(args.q).match(/name contains '([^']*)'/)?.[1]?.toLowerCase() ?? "";
        return { files: archivos.filter((a) => a.name.toLowerCase().includes(t)) };
      }
      if (herramienta === "GOOGLEDRIVE_DOWNLOAD_FILE") {
        const a = archivos.find((x) => x.id === args.fileId);
        return a ? { name: a.name, downloaded_file_content: { name: a.name, mimetype: a.mimeType, s3url: "https://almacen.composio.dev/vitrina" } } : {};
      }
      if (herramienta === "GMAIL_FETCH_EMAILS") return { messages: String(args.query).match(/(^|\s)in:sent/) ? [] : (buzones[cuenta] ?? []) };
      if (herramienta === "GMAIL_FETCH_MESSAGE_BY_THREAD_ID") return { messages: Object.values(buzones).flat().filter((x) => x.threadId === args.thread_id) };
      return {};
    },
  };
}

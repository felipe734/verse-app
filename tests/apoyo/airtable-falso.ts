import { ErrorAirtable, type ClienteAirtable, type PayloadWebhook, type RegistroAirtable } from "@/lib/airtable/cliente";

let contador = 0;
export const recId = () => `rec${String(++contador).padStart(14, "0")}`;

/** Airtable en memoria. Datos inventados, nunca reales. */
export class AirtableFalso implements ClienteAirtable {
  tablas = new Map<string, Map<string, RegistroAirtable>>();
  webhooks: { idBase: string; idTabla: string; url: string; id: string }[] = [];
  payloadsPendientes: PayloadWebhook[] = [];
  llamadas: string[] = [];
  falloSiguiente: number | null = null;

  private tabla(idBase: string, idTabla: string) {
    const k = `${idBase}/${idTabla}`;
    if (!this.tablas.has(k)) this.tablas.set(k, new Map());
    return this.tablas.get(k)!;
  }

  poner(idBase: string, idTabla: string, fields: Record<string, unknown>, id = recId()): RegistroAirtable {
    const r = { id, createdTime: "2026-11-01T00:00:00.000Z", fields };
    this.tabla(idBase, idTabla).set(id, r);
    return r;
  }

  quitar(idBase: string, idTabla: string, id: string) {
    this.tabla(idBase, idTabla).delete(id);
  }

  private fallar() {
    if (this.falloSiguiente) {
      const e = this.falloSiguiente;
      this.falloSiguiente = null;
      throw new ErrorAirtable(`Airtable respondió ${e}`, e);
    }
  }

  async esquema() {
    return [];
  }
  async todos(idBase: string, idTabla: string) {
    this.llamadas.push("todos");
    return [...this.tabla(idBase, idTabla).values()].map((r) => structuredClone(r));
  }
  async porIds(idBase: string, idTabla: string, ids: string[]) {
    this.llamadas.push("porIds");
    const t = this.tabla(idBase, idTabla);
    return ids.flatMap((id) => (t.has(id) ? [structuredClone(t.get(id)!)] : []));
  }
  async obtener(idBase: string, idTabla: string, id: string) {
    this.llamadas.push("obtener");
    const r = this.tabla(idBase, idTabla).get(id);
    return r ? structuredClone(r) : null;
  }
  async actualizar(idBase: string, idTabla: string, id: string, campos: Record<string, unknown>) {
    this.llamadas.push("actualizar");
    this.fallar();
    const r = this.tabla(idBase, idTabla).get(id);
    if (!r) throw new ErrorAirtable("Airtable respondió 404", 404);
    r.fields = { ...r.fields, ...campos };
    return structuredClone(r);
  }
  async crear(idBase: string, idTabla: string, campos: Record<string, unknown>) {
    this.llamadas.push("crear");
    this.fallar();
    return structuredClone(this.poner(idBase, idTabla, campos));
  }
  async crearWebhook(idBase: string, idTabla: string, url: string) {
    const id = `ach${String(this.webhooks.length + 1).padStart(14, "0")}`;
    this.webhooks.push({ idBase, idTabla, url, id });
    return { id, macSecretBase64: Buffer.from("secreto-de-prueba").toString("base64"), expirationTime: "2026-11-30T00:00:00.000Z" };
  }
  async renovarWebhook() {
    return { expirationTime: "2026-12-07T00:00:00.000Z" };
  }
  async payloads(_idBase: string, _webhookId: string, cursor: number) {
    const payloads = this.payloadsPendientes;
    this.payloadsPendientes = [];
    return { payloads, cursor: cursor + payloads.length, mightHaveMore: false };
  }
}

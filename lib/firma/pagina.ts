import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Página de firmas al final del contrato y la posición de cada caja para Auco (portada de
 * verse-docs/lib/firmas.js). Auco mide x = (izquierda + ancho) / ancho de página y
 * y = (arriba + alto) / alto de página, desde arriba.
 */

const CAJA = { w: 210, h: 70 };

export interface FirmanteHoja {
  rol: string;
  name: string;
  detalle?: string;
}

export interface Posicion {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Helvetica no tiene todos los caracteres: lo que no sea Latin-1 se cambia por "?". */
const latin1 = (t: string) => t.replace(/[^\u0000-ÿ]/g, "?");

export async function agregarPaginaFirmas(pdf: Buffer, o: { titulo: string; hash: string; firmantes: FirmanteHoja[] }): Promise<{ pdf: Buffer; posiciones: Posicion[] }> {
  const doc = await PDFDocument.load(pdf);
  const ultima = doc.getPage(doc.getPageCount() - 1);
  const { width: W, height: H } = ultima.getSize();
  const page = doc.addPage([W, H]);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0, 0.14, 0.28);
  const gris = rgb(0.29, 0.35, 0.44);
  const izq = 60;

  page.drawText("PÁGINA DE FIRMAS", { x: izq, y: H - 80, size: 14, font: fb, color: tinta });
  page.drawText(latin1(o.titulo).slice(0, 90), { x: izq, y: H - 102, size: 10, font: f, color: tinta });
  page.drawText(`Huella del documento (SHA-256): ${o.hash}`, { x: izq, y: H - 120, size: 6.5, font: f, color: gris });
  page.drawText("Las partes firman electrónicamente conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012.", { x: izq, y: H - 134, size: 8, font: f, color: gris });

  const posiciones: Posicion[] = [];
  o.firmantes.forEach((p, i) => {
    const left = izq + (i % 2) * (CAJA.w + 50);
    const top = 190 + Math.floor(i / 2) * 170;
    const y = H - top - CAJA.h;
    page.drawRectangle({ x: left, y, width: CAJA.w, height: CAJA.h, borderColor: rgb(0.84, 0.85, 0.88), borderWidth: 0.8 });
    page.drawLine({ start: { x: left, y: y - 6 }, end: { x: left + CAJA.w, y: y - 6 }, thickness: 0.8, color: tinta });
    page.drawText(latin1(p.rol).toUpperCase(), { x: left, y: y - 20, size: 8.5, font: fb, color: tinta });
    page.drawText(latin1(p.name).slice(0, 42), { x: left, y: y - 33, size: 8.5, font: f, color: tinta });
    if (p.detalle) page.drawText(latin1(p.detalle).slice(0, 48), { x: left, y: y - 45, size: 7.5, font: f, color: gris });
    posiciones.push({ page: doc.getPageCount(), x: Number(((left + CAJA.w) / W).toFixed(4)), y: Number(((top + CAJA.h) / H).toFixed(4)), w: CAJA.w, h: CAJA.h });
  });
  return { pdf: Buffer.from(await doc.save()), posiciones };
}

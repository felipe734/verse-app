import { sinEntidades } from "./bandeja";

const ENTIDADES_NUM = (s: string) => s.replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)));

export const pareceHtml = (t: string) => /<\/?(html|body|div|p|br|table|td|span|a|img|style|head)\b/i.test(t);

/**
 * Correo HTML a texto legible: párrafos, saltos, viñetas y enlaces como "texto (url)". El HTML
 * del remitente nunca se pinta en la app (ni estilos, ni scripts, ni imágenes de rastreo).
 */
export function htmlATexto(html: string): string {
  let t = html
    .replace(/<(head|style|script|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url: string, txt: string) => {
      const limpio = txt.replace(/<[^>]+>/g, "").trim();
      if (!limpio) return "";
      return /^https?:/i.test(url) && !limpio.includes(url) && url.length < 120 ? `${limpio} (${url})` : limpio;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|tr|h[1-6]|li|ul|ol|table|blockquote)>/gi, "\n")
    .replace(/<(p|div|tr|h[1-6]|table|blockquote)\b[^>]*>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, "");
  t = ENTIDADES_NUM(sinEntidades(t));
  return t
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Texto para leer un mensaje: si viene en HTML, se convierte; si no, se deja. */
export function textoLegible(t: string): string {
  return pareceHtml(t) ? htmlATexto(t) : ENTIDADES_NUM(sinEntidades(t)).replace(/\n{3,}/g, "\n\n").trim();
}

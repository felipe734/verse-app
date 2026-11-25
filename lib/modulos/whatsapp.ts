/** Enlace de WhatsApp para un celular colombiano o internacional; null si no hay número. */
export function enlaceWhatsapp(valor: string): string | null {
  let d = valor.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10 && d.startsWith("3")) d = `57${d}`;
  return d.length >= 10 ? `https://wa.me/${d}` : null;
}

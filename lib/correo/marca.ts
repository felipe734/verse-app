/**
 * Correo a terceros con la marca (verse-marca): envoltura, franja Navy con el punto naranja,
 * párrafos, firma y pie. Solo estilos en línea y fondos dobles (bgcolor y background-color).
 * El texto se escapa: lo que escribe la persona o el modelo nunca entra como HTML.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface Marca {
  empresa: "verse" | "cyc";
  /** HOST o LIVING para Verse; vacío para el grupo. */
  submarca?: string;
  cuerpo: string;
  firma: string;
  pie: string;
}

export function parrafos(cuerpo: string): string[] {
  return cuerpo
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function htmlCorreo(m: Marca): string {
  const marca = m.empresa === "cyc" ? "C&amp;C GROUP" : "VERSE";
  const sub = m.empresa === "verse" && m.submarca ? `<span style="font-size:12px;letter-spacing:2px;color:#A9B8CC;margin-left:10px;">${esc(m.submarca)}</span>` : "";
  const cuerpo = parrafos(m.cuerpo)
    .map(
      (p, i) =>
        `<tr><td style="padding:${i === 0 ? "26px" : "14px"} 28px 0;font-size:14.5px;line-height:1.6;color:#3B4D63;">${esc(p).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");
  return [
    `<link href="https://fonts.googleapis.com/css2?family=Gantari:wght@400;500&family=Lato:wght@400;700&display=swap" rel="stylesheet">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F3F3F1" style="background-color:#F3F3F1;"><tr><td style="padding:20px 10px;font-family:Lato,'Helvetica Neue',Arial,sans-serif;color:#002448;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #E6E6E3;border-radius:16px;border-collapse:separate;">`,
    `<tr><td bgcolor="#002448" style="background-color:#002448;padding:18px 28px;border-radius:16px 16px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-family:Gantari,'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:4px;color:#ffffff;">${marca}${sub}</td><td align="right"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background-color:#FF6501;"></span></td></tr></table></td></tr>`,
    cuerpo,
    `<tr><td style="padding:28px 28px 0;font-size:14.5px;color:#002448;">${esc(m.firma)}</td></tr>`,
    `<tr><td style="padding:26px 28px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E6E8EC;"><tr><td style="padding-top:14px;font-family:Gantari,Arial,sans-serif;font-size:11.5px;color:#8A98A6;">${esc(m.pie)}</td></tr></table></td></tr>`,
    `</table></td></tr></table>`,
  ].join("");
}

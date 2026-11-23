/** "23/11/2026", "23/11/2026 8:30am" o "2026-11-23" → { fecha: "2026-11-23", hora: "8:30 a. m." }. */
export function leerFecha(v: string | undefined): { fecha: string; hora: string } | null {
  if (!v) return null;
  const d = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const fecha = d ? `${d[3]}-${d[2]!.padStart(2, "0")}-${d[1]!.padStart(2, "0")}` : iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  if (!fecha) return null;
  const h = v.match(/(\d{1,2}):(\d{2})\s*([ap])?/i);
  let hora = "";
  if (h) {
    let n = Number(h[1]);
    if (h[3]?.toLowerCase() === "p" && n < 12) n += 12;
    if (h[3]?.toLowerCase() === "a" && n === 12) n = 0;
    hora = `${n % 12 || 12}:${h[2]} ${n < 12 ? "a. m." : "p. m."}`;
  }
  return { fecha, hora };
}

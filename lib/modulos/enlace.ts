/** Primer enlace de una celda: un campo URL o un adjunto ("archivo.pdf (https://…)"). */
export function enlaceDe(valor: string): { url: string; drive: boolean } | null {
  const m = valor.match(/https?:\/\/[^\s)"',]+/);
  if (!m) return null;
  return { url: m[0], drive: /drive\.google|docs\.google/.test(m[0]) };
}

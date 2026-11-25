/**
 * Color de un estado por su significado, igual en toda la app: hecho en verde, en curso en
 * azul, pendiente en ámbar, problema en rojo; lo demás neutro. Sobrio: punto y texto, sin
 * fondos chillones.
 */
export type Tono = "ok" | "curso" | "pendiente" | "problema" | "neutro";

const REGLAS: [Tono, RegExp][] = [
  ["problema", /vencid|rechaz|bloque|error|cancel|perdid|descart|no renueva|terminaci|sin aseadora|da[nñ]o/i],
  ["ok", /^(pago|pagado|hecho|hecha|terminad|listo|firmad|cerrad|ganad|renovad|completad|conciliad|aprobad|validad|activo|actual|limpi)/i],
  ["curso", /curso|enviad|contactad|visita|programad|elaborad|revisad|firm[oó] residente|datos pedidos|contrato|futuro/i],
  ["pendiente", /pendient|por pagar|por identificar|sin soporte|nuevo|lead|abiert|hoy|esperando|propuesta|salida/i],
];

export function tonoDe(estado: string): Tono {
  const e = estado.trim();
  if (!e) return "neutro";
  for (const [t, r] of REGLAS) if (r.test(e)) return t;
  return "neutro";
}

export const CLASE_TONO: Record<Tono, string> = {
  ok: "text-emerald-700 dark:text-emerald-400 [&>i]:bg-emerald-500",
  curso: "text-sky-700 dark:text-sky-400 [&>i]:bg-sky-500",
  pendiente: "text-amber-700 dark:text-amber-400 [&>i]:bg-amber-500",
  problema: "text-red-700 dark:text-red-400 [&>i]:bg-red-500",
  neutro: "text-muted-foreground [&>i]:bg-muted-foreground/50",
};

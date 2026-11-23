import type { ClienteComposio } from "./composio";

/**
 * Cuentas de la app (os-correo references/cuentas.md). La personal no entra: la app es de
 * Verse y C&C. El id gmail_… es el nombre estable que Composio le dio al conectar.
 */
export const CUENTAS = [
  { id: "verse-felipe", empresa: "verse", correo: "felipe@verseliving.com", composio: "gmail_tarn-wait" },
  { id: "verse-contabilidad", empresa: "verse", correo: "contabilidad@verseliving.com", composio: "gmail_twelve-ovally" },
  { id: "verse-contacto", empresa: "verse", correo: "contacto@verseliving.com", composio: "gmail_anon-erbia" },
  { id: "cyc-comercial", empresa: "cyc", correo: "comercial@constructoraccgroup.com", composio: "gmail_vetch-hummer" },
  { id: "cyc-contabilidad", empresa: "cyc", correo: "contabilidad@constructoraccgroup.com", composio: "gmail_fender-sumph" },
] as const;

export type IdCuenta = (typeof CUENTAS)[number]["id"];
export type Cuenta = (typeof CUENTAS)[number];

export const cuentaPorId = (id: string): Cuenta | undefined => CUENTAS.find((c) => c.id === id);

/**
 * De cuenta de la app a cuenta conectada de Composio. Se reconoce por el alias o el nombre
 * gmail_… y solo si está activa. Una cuenta que no aparece se reporta, no se adivina.
 */
export async function resolverCuentas(cliente: ClienteComposio): Promise<{ mapa: Map<IdCuenta, string>; faltan: IdCuenta[] }> {
  const conectadas = (await cliente.cuentasGmail()).filter((c) => c.estado.toUpperCase() === "ACTIVE");
  const mapa = new Map<IdCuenta, string>();
  for (const c of CUENTAS) {
    const hallada = conectadas.find((x) => x.wordId === c.composio || x.alias === c.id || x.id === c.composio);
    if (hallada) mapa.set(c.id, hallada.id);
  }
  return { mapa, faltan: CUENTAS.filter((c) => !mapa.has(c.id)).map((c) => c.id) };
}

let cache: { vence: number; valor: Awaited<ReturnType<typeof resolverCuentas>> } | null = null;

/** Igual que resolverCuentas, con 10 minutos de memoria por instancia del servidor. */
export async function cuentasConectadas(cliente: ClienteComposio, ahora = Date.now()) {
  if (cache && cache.vence > ahora) return cache.valor;
  const valor = await resolverCuentas(cliente);
  cache = { vence: ahora + 10 * 60_000, valor };
  return valor;
}

export function olvidarCuentas() {
  cache = null;
}

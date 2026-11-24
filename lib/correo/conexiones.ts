import type { ClienteComposio, CuentaConectada, ToolkitConexion } from "./composio";
import { CUENTAS, olvidarCuentas } from "./cuentas";
import { ALIAS_DRIVE, olvidarDrive } from "@/lib/drive/drive";

/**
 * Conexiones de la app en su proyecto de Composio: las cinco cuentas de Gmail de Verse y C&C
 * y el Drive. Cada una se reconoce por su alias; la personal nunca entra.
 */
export const CONEXIONES: { alias: string; toolkit: ToolkitConexion; nombre: string; legado?: string }[] = [
  ...CUENTAS.map((c) => ({ alias: c.id as string, toolkit: "gmail" as const, nombre: c.correo as string, legado: c.composio as string })),
  { alias: ALIAS_DRIVE, toolkit: "googledrive", nombre: "Google Drive de Verse" },
];

export type EstadoConexion = "activa" | "inactiva" | "falta";

export interface Conexion {
  alias: string;
  nombre: string;
  toolkit: ToolkitConexion;
  estado: EstadoConexion;
  id: string | null;
}

const deAlias = (lista: CuentaConectada[], alias: string, legado?: string) =>
  lista.find((x) => x.alias === alias && x.estado.toUpperCase() === "ACTIVE") ??
  lista.find((x) => legado && x.wordId === legado && x.estado.toUpperCase() === "ACTIVE") ??
  lista.find((x) => x.alias === alias);

export async function estadoConexiones(cliente: ClienteComposio): Promise<Conexion[]> {
  const [gmail, drive] = await Promise.all([cliente.cuentasGmail(), cliente.cuentasDrive()]);
  return CONEXIONES.map((c) => {
    const x = deAlias(c.toolkit === "gmail" ? gmail : drive, c.alias, c.legado);
    return { alias: c.alias, nombre: c.nombre, toolkit: c.toolkit, id: x?.id ?? null, estado: !x ? "falta" : x.estado.toUpperCase() === "ACTIVE" ? "activa" : "inactiva" };
  });
}

/**
 * Empieza a conectar una cuenta. Si ya está activa no hace nada; si quedó a medias o vencida,
 * la borra primero para que el alias quede libre. Devuelve la URL de Google, o null si ya estaba.
 */
export async function conectarCuenta(cliente: ClienteComposio, alias: string, volver: string): Promise<string | null> {
  const c = CONEXIONES.find((x) => x.alias === alias);
  if (!c) throw new Error("Esa cuenta no es de la app");
  const actual = (await estadoConexiones(cliente)).find((x) => x.alias === alias)!;
  if (actual.estado === "activa") return null;
  if (actual.estado === "inactiva" && actual.id) await cliente.quitar(actual.id);
  olvidarCuentas();
  olvidarDrive();
  return cliente.conectar(c.toolkit, alias, volver);
}

import type { ItemNav } from "./registro";

/**
 * Barra inferior del celular según el rol: cada quien ve primero lo que usa en el día.
 *   maestro  Inicio, Finanzas, Asistente, Hoy, Más
 *   equipo   Inicio, Hoy, Asistente, su módulo de operación, Más
 *   aseo     Ruta de aseo, Asistente, lo más usado, Más
 * Un puesto sin módulo visible se llena con el más usado en este celular.
 */
export type RolMovil = "maestro" | "equipo" | "aseo";

const OPERACION = ["limpiezas", "operacion", "comercial-living", "contratos", "cobros", "pagos-obra"];

const PUESTOS: Record<RolMovil, string[][]> = {
  maestro: [["inicio"], ["finanzas", "finanzas-cyc"], ["hoy"]],
  equipo: [["inicio"], ["hoy"], OPERACION],
  aseo: [["ruta"], ["hoy"], ["equipo", "limpiezas"]],
};

export function rolMovil(maestro: boolean, items: ItemNav[]): RolMovil {
  if (maestro) return "maestro";
  const tipos = new Set(items.map((i) => i.tipo));
  return !tipos.has("hoy") && tipos.has("ruta") ? "aseo" : "equipo";
}

/** Con Hoy visible, Inicio va como acceso propio. */
function conInicio(items: ItemNav[]): ItemNav[] {
  const hoy = items.find((i) => i.tipo === "hoy");
  return hoy ? [{ ...hoy, id: "inicio", tipo: "inicio", nombre: "Inicio", icono: "house", href: "/inicio", contador: undefined }, ...items] : items;
}

/** Los tres accesos fijos de la barra, en orden. El Asistente va entre el segundo y el tercero. */
export function accesosMovil(rol: RolMovil, items: ItemNav[], usos: Record<string, number> = {}): ItemNav[] {
  const todos = conInicio(items);
  const elegidos: (ItemNav | undefined)[] = PUESTOS[rol].map((tipos) => {
    for (const t of tipos) {
      const i = todos.find((x) => x.tipo === t);
      if (i) return i;
    }
    return undefined;
  });
  const usados = new Set(elegidos.filter(Boolean).map((i) => i!.href));
  const resto = todos.filter((i) => i.tipo !== "inicio" && !usados.has(i.href)).sort((a, b) => (usos[b.href] ?? 0) - (usos[a.href] ?? 0));
  return elegidos
    .map((i) => {
      if (i) return i;
      const otro = resto.shift();
      return otro;
    })
    .filter((i): i is ItemNav => Boolean(i));
}

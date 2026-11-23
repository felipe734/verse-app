import "server-only";
import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/acceso/actual";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { empresasVisibles } from "@/lib/acceso/permisos";
import { inicioDe, navegacion, TODAS } from "./registro";

/** Rutas de antes (/hoy, /aprobar…) → /[empresa]/[vertical]/[modulo] del mismo tipo. */
export async function redirigirA(tipo: string, empresaPedida?: string | null, extra = ""): Promise<never> {
  const s = await sesionActual();
  const estructura = s.estructura ?? ESTRUCTURA;
  const visibles = empresasVisibles(s);
  const orden = empresaPedida === TODAS ? [TODAS, ...visibles] : empresaPedida ? [empresaPedida, ...visibles] : visibles;
  for (const e of orden) {
    if (e !== TODAS && !visibles.includes(e)) continue;
    const item = navegacion(s, estructura, e)
      .flatMap((g) => g.items)
      .find((i) => i.tipo === tipo);
    if (item) redirect(`${item.href}${extra}`);
  }
  // Sin ese módulo (aseo no tiene Hoy): a su primera pantalla, la Ruta de aseo por ejemplo.
  const inicio = inicioDe(s, estructura, visibles);
  redirect(inicio ?? "/sin-acceso");
}

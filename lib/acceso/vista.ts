import { ESTRUCTURA } from "./estructura";
import { empresasVisibles, modulosVisibles, type Sesion } from "./permisos";

export interface VistaHoy {
  empresas: { id: string; nombre: string }[];
  /** Empresa elegida; null si la persona no tiene ninguna. */
  empresa: string | null;
  grupos: { empresa: string; vertical: string; modulos: { id: string; nombre: string; descripcion: string }[] }[];
}

/**
 * Lo que Hoy muestra para una sesión: empresas que puede abrir y módulos de la elegida.
 * Pasa por la función única de permisos; nada fuera de ella llega a la pantalla.
 */
export function vistaHoy(s: Sesion | null, pedida?: string | null): VistaHoy {
  const estructura = s?.estructura ?? ESTRUCTURA;
  const visibles = empresasVisibles(s);
  const empresas = visibles.map((id) => ({ id, nombre: estructura.find((e) => e.id === id)?.nombre ?? id }));
  const empresa = pedida && visibles.includes(pedida) ? pedida : (visibles[0] ?? null);
  const elegidas = empresa ? [empresa] : [];
  const grupos = elegidas.flatMap((id) => {
    const e = estructura.find((x) => x.id === id)!;
    const mios = new Set(modulosVisibles(s, id));
    return e.verticales
      .map((v) => ({ empresa: e.nombre, vertical: v.nombre, modulos: v.modulos.filter((m) => mios.has(m.id)) }))
      .filter((g) => g.modulos.length > 0);
  });
  return { empresas, empresa, grupos };
}

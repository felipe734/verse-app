import { sesionActual } from "@/lib/acceso/actual";
import { puede } from "@/lib/acceso/permisos";
import { atenderSubida } from "@/lib/servidor/blob";

const MODULO: Record<string, string> = { verse: "verse-finanzas", cyc: "cyc-finanzas" };

/** Subida directa del soporte de un gasto: solo quien edita Finanzas de esa empresa, imagen o PDF hasta 15 MB. */
export async function POST(request: Request) {
  return atenderSubida(request, {
    carpeta: "soportes",
    tipos: ["image/*", "application/pdf"],
    maxBytes: 15 * 1024 * 1024,
    autorizar: async (payload) => {
      const modulo = MODULO[String(payload)];
      if (!modulo || !puede(await sesionActual(), String(payload), modulo, "editar")) throw new Error("Sin acceso a Finanzas");
    },
  });
}

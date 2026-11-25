import { sesionActual } from "@/lib/acceso/actual";
import { puede } from "@/lib/acceso/permisos";
import { MODULO_COBROS } from "@/lib/cobros/soporte";
import { atenderSubida } from "@/lib/servidor/blob";

/** Subida directa del comprobante de un arriendo: solo quien edita Cobros, imagen o PDF hasta 15 MB. */
export async function POST(request: Request) {
  return atenderSubida(request, {
    carpeta: "cobros",
    tipos: ["image/*", "application/pdf"],
    maxBytes: 15 * 1024 * 1024,
    autorizar: async () => {
      if (!puede(await sesionActual(), "verse", MODULO_COBROS, "editar")) throw new Error("Sin acceso a Cobros");
    },
  });
}

import { sesionActual } from "@/lib/acceso/actual";
import { puede } from "@/lib/acceso/permisos";
import { MODULO_RUTA } from "@/lib/ruta/ruta";
import { atenderSubida } from "@/lib/servidor/blob";

/** Subida directa del video del reporte: solo quien opera la Ruta de aseo, solo video, hasta 500 MB. */
export async function POST(request: Request) {
  return atenderSubida(request, {
    carpeta: "servicios",
    tipos: ["video/*"],
    maxBytes: 500 * 1024 * 1024,
    autorizar: async () => {
      if (!puede(await sesionActual(), "verse", MODULO_RUTA, "editar")) throw new Error("Sin acceso a la Ruta de aseo");
    },
  });
}

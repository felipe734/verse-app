import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/acceso/actual";
import { puede } from "@/lib/acceso/permisos";
import { MODULO_RUTA } from "@/lib/ruta/ruta";

/**
 * Token de subida directa del celular a Vercel Blob para el video del reporte. Solo quien
 * opera la Ruta de aseo, solo video y con tope de tamaño. La URL que queda (con sufijo
 * aleatorio) se pasa a SERVICIOS y Airtable guarda su propia copia.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Falta configurar el almacenamiento de videos" }, { status: 503 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const r = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const s = await sesionActual();
        if (!puede(s, "verse", MODULO_RUTA, "editar")) throw new Error("Sin acceso a la Ruta de aseo");
        return { allowedContentTypes: ["video/*"], maximumSizeInBytes: 500 * 1024 * 1024, addRandomSuffix: true, tokenPayload: s.correo };
      },
    });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo subir" }, { status: 400 });
  }
}

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/acceso/actual";
import { puede } from "@/lib/acceso/permisos";

const MODULO: Record<string, string> = { verse: "verse-finanzas", cyc: "cyc-finanzas" };

/**
 * Token de subida directa a Vercel Blob para el soporte de un gasto de caja menor: solo quien
 * edita Finanzas de esa empresa, solo imagen o PDF y hasta 15 MB.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Falta configurar el almacenamiento de archivos" }, { status: 503 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const r = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_ruta, payload) => {
        const s = await sesionActual();
        const modulo = MODULO[String(payload)];
        if (!modulo || !puede(s, String(payload), modulo, "editar")) throw new Error("Sin acceso a Finanzas");
        return { allowedContentTypes: ["image/*", "application/pdf"], maximumSizeInBytes: 15 * 1024 * 1024, addRandomSuffix: true, tokenPayload: s.correo };
      },
    });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo subir" }, { status: 400 });
  }
}

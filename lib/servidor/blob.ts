import "server-only";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

/**
 * Archivos de la app (videos de la Ruta, soportes de caja menor) en Vercel Blob. El almacén
 * es privado y se conecta por OIDC (BLOB_STORE_ID, sin token de lectura y escritura): el
 * celular sube directo con una URL firmada que solo da el servidor, y a Airtable se le pasa
 * una URL de lectura firmada por 24 horas, tiempo de sobra para que guarde su propia copia.
 */

export const subidasActivas = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

const UN_DIA = 24 * 60 * 60 * 1000;

/** Ruta del archivo en el almacén: sin "..", sin barra inicial y dentro de la carpeta esperada. */
export function rutaValida(ruta: unknown, carpeta: string): ruta is string {
  return typeof ruta === "string" && ruta.length < 400 && ruta.startsWith(`${carpeta}/`) && !ruta.includes("..") && !ruta.includes("//");
}

/** URL de lectura firmada para que Airtable copie el archivo. */
export async function urlDeLectura(ruta: string, ahora = Date.now()): Promise<string> {
  const validUntil = ahora + UN_DIA;
  const token = await issueSignedToken({ pathname: ruta, operations: ["get"], validUntil });
  const { presignedUrl } = await presignUrl(token, { operation: "get", pathname: ruta, validUntil, access: "private" });
  return presignedUrl;
}

/** Atiende la subida directa: revisa el acceso y firma solo la ruta, el tipo y el tamaño pedidos. */
export async function atenderSubida(
  request: Request,
  opciones: { carpeta: string; tipos: string[]; maxBytes: number; autorizar: (payload: string | null) => Promise<void> },
): Promise<NextResponse> {
  if (!subidasActivas()) return NextResponse.json({ error: "Falta configurar el almacenamiento de archivos" }, { status: 503 });
  try {
    const body = (await request.json()) as HandleUploadPresignedBody;
    const r = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (ruta, payload) => {
        await opciones.autorizar(payload);
        if (!rutaValida(ruta, opciones.carpeta)) throw new Error("Ruta de archivo inválida");
        const token = await issueSignedToken({
          pathname: ruta,
          operations: ["put"],
          allowedContentTypes: opciones.tipos,
          maximumSizeInBytes: opciones.maxBytes,
          validUntil: Date.now() + 60 * 60 * 1000,
        });
        return { token, urlOptions: { addRandomSuffix: true, allowedContentTypes: opciones.tipos, maximumSizeInBytes: opciones.maxBytes } };
      },
    });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo subir" }, { status: 400 });
  }
}

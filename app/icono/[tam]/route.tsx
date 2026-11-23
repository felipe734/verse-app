import { ImageResponse } from "next/og";
import { PLATFORM_NAME } from "@/lib/config";

const TAMANOS = new Set([180, 192, 512]);

/** Ícono de la plataforma: neutro, la inicial de PLATFORM_NAME sobre zinc oscuro. */
export async function GET(_: Request, { params }: RouteContext<"/icono/[tam]">) {
  const { tam } = await params;
  const lado = Number(tam);
  if (!TAMANOS.has(lado)) return new Response("Tamaño no disponible", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fafafa", fontSize: lado * 0.5, fontWeight: 600, letterSpacing: -lado * 0.02, lineHeight: 1 }}>{PLATFORM_NAME.charAt(0).toUpperCase()}</div>
      </div>
    ),
    { width: lado, height: lado },
  );
}

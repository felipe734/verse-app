import { ImageResponse } from "next/og";

const TAMANOS = new Set([180, 192, 512]);

/** Ícono de la app: fondo Navy, la V en blanco y el punto naranja de la marca. */
export async function GET(_: Request, { params }: RouteContext<"/icono/[tam]">) {
  const { tam } = await params;
  const lado = Number(tam);
  if (!TAMANOS.has(lado)) return new Response("Tamaño no disponible", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#002448", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ color: "#ffffff", fontSize: lado * 0.55, fontWeight: 700, letterSpacing: -lado * 0.02, lineHeight: 1 }}>V</div>
        <div
          style={{
            position: "absolute",
            right: lado * 0.22,
            bottom: lado * 0.24,
            width: lado * 0.09,
            height: lado * 0.09,
            borderRadius: "50%",
            background: "#FF6501",
          }}
        />
      </div>
    ),
    { width: lado, height: lado },
  );
}

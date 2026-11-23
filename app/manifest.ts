import type { MetadataRoute } from "next";
import { PLATFORM_NAME } from "@/lib/config";

/** La app se instala en el celular desde el navegador; en iPhone, los avisos necesitan la app instalada. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PLATFORM_NAME,
    short_name: PLATFORM_NAME,
    description: "Plataforma de operación sobre Airtable",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#09090b",
    lang: "es",
    icons: [
      { src: "/icono/192", sizes: "192x192", type: "image/png" },
      { src: "/icono/512", sizes: "512x512", type: "image/png" },
      { src: "/icono/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

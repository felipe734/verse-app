import type { MetadataRoute } from "next";

/** La app se instala en el celular desde el navegador; en iPhone, los avisos necesitan la app instalada. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Verse App",
    short_name: "Verse",
    description: "Operación de Verse Group y C&C Group",
    start_url: "/hoy",
    display: "standalone",
    background_color: "#F3F3F1",
    theme_color: "#002448",
    lang: "es",
    icons: [
      { src: "/icono/192", sizes: "192x192", type: "image/png" },
      { src: "/icono/512", sizes: "512x512", type: "image/png" },
      { src: "/icono/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

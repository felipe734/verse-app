import { redirigirA } from "@/lib/modulos/redirigir";

/** /hoy de antes: lleva a /[empresa]/general/hoy. */
export default async function Hoy({ searchParams }: PageProps<"/hoy">) {
  const { empresa, verComo } = (await searchParams) as { empresa?: string; verComo?: string };
  return redirigirA("hoy", empresa, verComo ? `?verComo=${encodeURIComponent(verComo)}` : "");
}

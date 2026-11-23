import { redirigirA } from "@/lib/modulos/redirigir";

/** /sistema de antes: lleva a /[empresa]/general/sistema. */
export default async function Sistema({ searchParams }: PageProps<"/sistema">) {
  const { empresa } = (await searchParams) as { empresa?: string };
  return redirigirA("sistema", empresa);
}

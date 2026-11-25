import { redirect } from "next/navigation";

/** /sistema de antes: Sistema vive ahora en Ajustes. */
export default async function Sistema({ searchParams }: PageProps<"/sistema">) {
  const { empresa } = (await searchParams) as { empresa?: string };
  redirect(`/ajustes?vista=sistema${empresa ? `&empresa=${encodeURIComponent(empresa)}` : ""}`);
}

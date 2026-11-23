import { cuentaPorId } from "@/lib/correo/cuentas";
import { redirigirA } from "@/lib/modulos/redirigir";

/** /correo de antes: lleva a /[empresa]/general/correo. */
export default async function Correo({ searchParams }: PageProps<"/correo">) {
  const { cuenta } = (await searchParams) as { cuenta?: string };
  const c = cuenta ? cuentaPorId(cuenta) : undefined;
  return redirigirA("correo", c?.empresa, c ? `?cuenta=${c.id}` : "");
}

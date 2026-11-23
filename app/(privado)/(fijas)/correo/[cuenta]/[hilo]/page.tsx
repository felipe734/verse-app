import { cuentaPorId } from "@/lib/correo/cuentas";
import { redirigirA } from "@/lib/modulos/redirigir";

/** Enlace viejo a un hilo: lleva a la bandeja de su empresa con esa cuenta. */
export default async function Hilo({ params }: PageProps<"/correo/[cuenta]/[hilo]">) {
  const { cuenta } = await params;
  const c = cuentaPorId(cuenta);
  return redirigirA("correo", c?.empresa, c ? `?cuenta=${c.id}` : "");
}

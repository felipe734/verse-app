import { redirigirA } from "@/lib/modulos/redirigir";

/** /aprobar de antes: lleva a /[empresa]/general/aprobar. */
export default async function Aprobar() {
  return redirigirA("aprobar");
}

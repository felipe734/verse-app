import { Suspense } from "react";
import { EsqueletoModulo } from "@/components/modulos/encabezado";
import { Shell } from "@/components/shell/shell";

/** Ajustes y las rutas de antes: dentro del shell, con la primera empresa de la persona. */
export default function LayoutFijas({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<EsqueletoModulo />}>
      <Shell empresa={null}>{children}</Shell>
    </Suspense>
  );
}

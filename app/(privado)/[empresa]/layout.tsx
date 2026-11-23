import { Suspense } from "react";
import { EsqueletoModulo } from "@/components/modulos/encabezado";
import { Shell } from "@/components/shell/shell";

async function ConEmpresa({ params, children }: { params: Promise<{ empresa: string }>; children: React.ReactNode }) {
  const { empresa } = await params;
  return <Shell empresa={empresa}>{children}</Shell>;
}

/** La empresa activa vive en la URL: /[empresa]/[vertical]/[modulo]. */
export default function LayoutEmpresa({ params, children }: LayoutProps<"/[empresa]">) {
  return (
    <Suspense fallback={<EsqueletoModulo />}>
      <ConEmpresa params={params}>{children}</ConEmpresa>
    </Suspense>
  );
}

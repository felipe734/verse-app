import { Suspense } from "react";
import { auth } from "@/auth";
import { Asistente } from "@/components/asistente/asistente";
import { db } from "@/db/cliente";
import { empresasDelAsistente } from "@/lib/asistente/herramientas";
import { sesionDe } from "@/lib/acceso/sesion";

/** El asistente aparece en todas las pantallas privadas, solo si el acceso lo incluye. */
async function AsistenteSiAplica() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const correo = (await auth())?.user?.email;
  if (!correo) return null;
  const s = await sesionDe(db(), correo);
  if (!s || s.estado !== "activo" || empresasDelAsistente(s).length === 0) return null;
  return <Asistente />;
}

export default function LayoutPrivado({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <Suspense>
        <AsistenteSiAplica />
      </Suspense>
    </>
  );
}

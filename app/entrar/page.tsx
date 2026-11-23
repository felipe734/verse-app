import type { Metadata } from "next";
import { Suspense } from "react";
import { signIn } from "@/auth";
import { Marco } from "@/components/marco";
import { Button } from "@/components/ui/button";
import { MENSAJES_ENTRADA } from "@/lib/acceso/entrada";

export const metadata: Metadata = { title: "Entrar · Verse App" };

async function entrarConGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/inicio" });
}

async function Aviso({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  const texto = MENSAJES_ENTRADA[error] ?? "No se pudo entrar. Intenta de nuevo.";
  return (
    <p role="alert" className="rounded-lg bg-muted px-4 py-3 text-foreground">
      {texto}
    </p>
  );
}

export default function Entrar({ searchParams }: PageProps<"/entrar">) {
  return (
    <Marco rotulo="SOLO PERSONAS INVITADAS" titulo="Entrar">
      <p>Entra con la cuenta de Google con la que te invitaron.</p>
      <Suspense>
        <Aviso searchParams={searchParams as Promise<{ error?: string }>} />
      </Suspense>
      <form action={entrarConGoogle}>
        <Button type="submit" size="lg" className="w-full rounded-lg">
          Entrar con Google
        </Button>
      </form>
    </Marco>
  );
}

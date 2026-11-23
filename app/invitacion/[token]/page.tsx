import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { COOKIE_INVITACION, signIn } from "@/auth";
import { Marco } from "@/components/marco";
import { Button } from "@/components/ui/button";
import { db } from "@/db/cliente";
import { revisarInvitacion } from "@/lib/acceso/admin";

export const metadata: Metadata = { title: "Invitación · Verse App" };

const MOTIVOS = {
  "no-existe": "Este enlace no es válido.",
  vencida: "Este enlace venció. Pídele a Felipe uno nuevo.",
  usada: "Este enlace ya se usó. Entra desde app.verseliving.com.",
  suspendido: "Este acceso está suspendido.",
} as const;

async function aceptar(token: string) {
  "use server";
  (await cookies()).set(COOKIE_INVITACION, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600 });
  await signIn("google", { redirectTo: "/hoy" });
}

async function Contenido({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await revisarInvitacion(db(), token);
  if (!r.valida) return <p role="status">{MOTIVOS[r.motivo]}</p>;
  return (
    <>
      <p>
        Hola, {r.nombre}. Felipe te invitó a Verse App. Entra con tu cuenta de Google <b>{r.correo}</b>; con otra cuenta no
        funciona.
      </p>
      <form action={aceptar.bind(null, token)}>
        <Button type="submit" size="lg" className="w-full rounded-xl">
          Entrar con Google
        </Button>
      </form>
    </>
  );
}

export default function Invitacion({ params }: PageProps<"/invitacion/[token]">) {
  return (
    <Marco rotulo="INVITACIÓN" titulo="Bienvenida a Verse App">
      <Suspense fallback={<p className="text-muted-foreground">Revisando el enlace</p>}>
        <Contenido params={params} />
      </Suspense>
    </Marco>
  );
}

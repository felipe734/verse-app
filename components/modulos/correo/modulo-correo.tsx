import { Mail } from "lucide-react";
import type { Sesion } from "@/lib/acceso/permisos";
import { bandejaDe, cuentasLegibles } from "@/lib/correo/bandeja";
import { cuentaPorId } from "@/lib/correo/cuentas";
import { nivelEnCuenta } from "@/lib/correo/redactar";
import { ErrorComposio } from "@/lib/correo/composio";
import { clasificadorHaiku, paraResponder } from "@/lib/correo/atencion";
import { composioServidor } from "@/lib/servidor/composio";
import { EncabezadoModulo } from "../encabezado";
import { Bandeja } from "./bandeja";

/** Correo de una empresa: sus cuentas de os-correo que la persona puede leer. */
export async function ModuloCorreo({ sesion, empresa, cuenta }: { sesion: Sesion; empresa: string; cuenta?: string }) {
  const cuentas = cuentasLegibles(sesion).filter((c) => c.empresa === empresa);
  const cliente = composioServidor();
  if (!cliente || cuentas.length === 0) {
    return (
      <>
        <EncabezadoModulo titulo="Correo" />
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-24 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Mail className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <p className="font-medium">{cliente ? "Tu acceso no incluye cuentas de correo aquí" : "El correo no está configurado"}</p>
          <p className="text-sm text-muted-foreground">{cliente ? "Pídele a quien administra la plataforma la cuenta que necesitas." : "Falta la clave de Composio en Vercel (COMPOSIO_API_KEY)."}</p>
        </div>
      </>
    );
  }
  const elegida = cuenta && cuentas.some((c) => c.id === cuenta) ? cuenta : null;
  let b: Awaited<ReturnType<typeof bandejaDe>>;
  try {
    b = await bandejaDe(cliente, sesion, { empresa, cuenta: elegida ?? undefined });
  } catch (e) {
    console.error("[correo]", e instanceof Error ? e.message : e);
    const clave = e instanceof ErrorComposio && (e.estado === 401 || e.estado === 403);
    return (
      <>
        <EncabezadoModulo titulo="Correo" />
        <div role="alert" className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-24 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Mail className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <p className="font-medium">{clave ? "Composio rechazó la clave" : "El correo no respondió"}</p>
          <p className="text-sm text-muted-foreground">
            {clave ? "Revisa COMPOSIO_API_KEY en Vercel: debe ser una API key del proyecto de Composio donde están conectadas las cuentas." : "Intenta de nuevo en un momento."}
          </p>
        </div>
      </>
    );
  }
  const todos = b.colas.flatMap((q) => q.items);
  const atencion = await paraResponder(
    todos.map((x) => ({ id: x.id, de: x.de, asunto: x.asunto, vista: x.vista, responde: x.ruta.responde })),
    clasificadorHaiku(),
  );
  const colas = b.colas.map((q) => ({
    id: q.id,
    items: q.items.map((x) => ({
      cuenta: x.cuenta,
      correoCuenta: cuentaPorId(x.cuenta)?.correo ?? x.cuenta,
      id: x.id,
      hilo: x.hilo,
      de: x.de,
      asunto: x.asunto,
      vista: x.vista,
      fecha: x.fecha,
      noLeido: x.noLeido,
      adjuntos: x.adjuntos,
      responde: x.ruta.responde,
      atencion: atencion.has(x.id),
      tambienEn: x.tambienEn,
    })),
  }));
  const puedeRedactar = cuentas.some((c) => ["redactar", "enviar"].includes(nivelEnCuenta(sesion, c.id)));
  return (
    <>
      <EncabezadoModulo titulo="Correo" descripcion={`Últimas ${b.horas} horas · primero lo que necesita respuesta`} />
      <Bandeja colas={colas} cuentas={cuentas.map((c) => ({ id: c.id, correo: c.correo }))} cuenta={elegida} ruido={b.ruido} avisos={b.avisos} horas={b.horas} puedeRedactar={puedeRedactar} />
    </>
  );
}

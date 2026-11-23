import { Mail } from "lucide-react";
import type { Sesion } from "@/lib/acceso/permisos";
import { bandejaDe, cuentasLegibles } from "@/lib/correo/bandeja";
import { cuentaPorId } from "@/lib/correo/cuentas";
import { nivelEnCuenta } from "@/lib/correo/redactar";
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
  const b = await bandejaDe(cliente, sesion, { empresa, cuenta: elegida ?? undefined });
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
      tambienEn: x.tambienEn,
    })),
  }));
  const puedeRedactar = cuentas.some((c) => ["redactar", "enviar"].includes(nivelEnCuenta(sesion, c.id)));
  return (
    <>
      <EncabezadoModulo titulo="Correo" descripcion={`Últimas ${b.horas} horas, ruteado por os-correo`} />
      <Bandeja colas={colas} cuentas={cuentas.map((c) => ({ id: c.id, correo: c.correo }))} cuenta={elegida} ruido={b.ruido} avisos={b.avisos} horas={b.horas} puedeRedactar={puedeRedactar} />
    </>
  );
}

"use client";

import { Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { enviarAFirmaAccion, prepararFirmaAccion } from "@/app/modulos/firma";
import { Button } from "@/components/ui/button";
import type { Preparacion } from "@/lib/firma/firma";

/** Firma del contrato dentro de la app: quién firma y, para el Maestro, el envío a Auco. */
export function FirmaContrato({ recId, estadoAuco }: { recId: string; estadoAuco: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [p, setP] = useState<Preparacion | null>(null);

  if (estadoAuco) return <p className="text-sm text-muted-foreground">Firma en Auco: {estadoAuco}</p>;

  async function preparar() {
    setOcupado(true);
    const r = await prepararFirmaAccion(recId);
    setOcupado(false);
    if (!r.ok) return void toast.error(r.mensaje);
    setP(r);
  }

  async function enviar(modo: "whatsapp" | "enlaces") {
    setOcupado(true);
    const r = await enviarAFirmaAccion(recId, modo);
    setOcupado(false);
    if (!r.ok) return void toast.error(r.mensaje);
    toast.success(r.mensaje);
    setP(null);
    router.refresh();
  }

  if (!p)
    return (
      <Button size="sm" variant="outline" className="gap-1.5" disabled={ocupado} onClick={() => void preparar()}>
        {ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Firma
      </Button>
    );

  return (
    <div className="space-y-3 rounded-lg border p-3 text-sm">
      <p className="font-medium">Firman, en este orden</p>
      <ol className="space-y-1 text-xs text-muted-foreground">
        {p.firmantes?.map((f, i) => (
          <li key={f.rol}>
            {i + 1}. <span className="font-medium text-foreground">{f.name}</span> · {f.rol} · {f.detalle}
            {f.identificacion ? ` · documento, cara y código por WhatsApp a ${f.phone}` : " · código por correo"}
          </li>
        ))}
      </ol>
      {p.puedeEnviar ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" disabled={ocupado} onClick={() => void enviar("whatsapp")}>
              {ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Enviar por WhatsApp
            </Button>
            <Button size="sm" variant="outline" disabled={ocupado} onClick={() => void enviar("enlaces")}>
              Solo crear enlaces
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Gasta un crédito de Auco y le llega al residente. Al terminar, el contrato queda Firmado y el PDF firmado en la unidad.</p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Listo para firma. Felipe lo envía desde aquí.</p>
      )}
    </div>
  );
}

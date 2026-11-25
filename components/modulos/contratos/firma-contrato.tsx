"use client";

import { Loader2, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { enviarAFirmaAccion, revisarContratoAccion } from "@/app/modulos/contratos";
import { Button } from "@/components/ui/button";
import type { Revision } from "@/lib/contratos/firma";

/**
 * Firma del contrato: primero la revisión de verse-docs contra el modelo aprobado; si sale OK,
 * el Maestro lo envía a Auco (WhatsApp o enlaces). Con alerta, verse-docs lo bloquea y avisa.
 */
export function FirmaContrato({ recId, estadoAuco }: { recId: string; estadoAuco: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<"revisar" | "enviar" | null>(null);
  const [rev, setRev] = useState<Revision | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  if (estadoAuco) return <p className="text-sm text-muted-foreground">Firma en Auco: {estadoAuco}</p>;

  async function revisar() {
    setOcupado("revisar");
    const r = await revisarContratoAccion(recId);
    setOcupado(null);
    if (!r.ok) return void toast.error(r.mensaje);
    setRev(r);
  }

  async function enviar(modo: "whatsapp" | "enlaces") {
    if (!rev?.token) return;
    setOcupado("enviar");
    const r = await enviarAFirmaAccion(recId, rev.token, modo);
    setOcupado(null);
    if (!r.ok) return void toast.error(r.mensaje);
    toast.success(r.mensaje);
    setRev(null);
    router.refresh();
  }

  return (
    <div className="space-y-3 text-sm">
      {!rev && (
        <Button size="sm" variant="outline" className="gap-1.5" disabled={ocupado !== null} onClick={() => void revisar()}>
          {ocupado === "revisar" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
          {ocupado === "revisar" ? "Revisando contra el modelo" : "Revisar para firma"}
        </Button>
      )}
      {rev && (
        <div className="space-y-2 rounded-lg border p-3">
          <p className={rev.resultado === "ok" ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-destructive"}>{rev.mensaje}</p>
          {rev.hallazgos?.length ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {rev.hallazgos.map((h, i) => (
                <li key={i}>
                  [{h.severidad}] {h.descripcion}
                  {h.ubicacion ? ` (${h.ubicacion})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {rev.resultado === "ok" && (
            <>
              <p className="text-xs text-muted-foreground">
                Firman: {rev.firmantes?.map((f) => `${f.name} (${f.rol})`).join(" y ")}
                {rev.firmaPor ? ` · por la empresa ${rev.firmaPor}` : ""}
              </p>
              {rev.puedeEnviar ? (
                confirmar ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-1.5" disabled={ocupado !== null} onClick={() => void enviar("whatsapp")}>
                      {ocupado === "enviar" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Sí, enviar por WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" disabled={ocupado !== null} onClick={() => void enviar("enlaces")}>
                      Solo enlaces
                    </Button>
                    <Button size="sm" variant="ghost" disabled={ocupado !== null} onClick={() => setConfirmar(false)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" className="gap-1.5" onClick={() => setConfirmar(true)}>
                    <Send className="size-4" aria-hidden /> Enviar a firma
                  </Button>
                )
              ) : (
                <p className="text-xs text-muted-foreground">Listo para firma. Felipe lo envía desde aquí.</p>
              )}
              {confirmar && <p className="text-xs text-muted-foreground">Gasta un crédito de Auco y le llega al residente. La revisión vale 24 horas.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

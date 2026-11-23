"use client";

import { useMemo, useState } from "react";
import { cancelar, resolverCorreo } from "@/app/asistente/acciones";
import { Button } from "@/components/ui/button";
import { vistaPreviaCliente } from "@/lib/correo/vista";

export interface DatosTarjetaCorreo {
  cuenta: string;
  de: string;
  para: string[];
  cc: string[];
  asunto: string;
  cuerpo: string;
  firma: string;
  submarca?: string;
  respuesta: boolean;
  puedeEnviar: boolean;
  html: string;
}

/**
 * Tarjeta de un correo propuesto: vista previa como la recibe el destinatario, edición a mano
 * y dos salidas, guardar el borrador en Gmail o enviar (con un segundo toque de confirmación).
 */
export function TarjetaCorreo({ id, correo }: { id: string; correo: DatosTarjetaCorreo }) {
  const [asunto, setAsunto] = useState(correo.asunto);
  const [cuerpo, setCuerpo] = useState(correo.cuerpo);
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  const html = useMemo(
    () => (asunto === correo.asunto && cuerpo === correo.cuerpo ? correo.html : vistaPreviaCliente({ cuenta: correo.cuenta, cuerpo, firma: correo.firma, submarca: correo.submarca })),
    [asunto, cuerpo, correo],
  );

  async function resolver(modo: "borrador" | "enviar" | "cancelar") {
    setOcupado(true);
    const r = modo === "cancelar" ? await cancelar(id) : await resolverCorreo(id, modo, { asunto, cuerpo });
    setOcupado(false);
    setResultado(r);
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{correo.respuesta ? "RESPUESTA POR CONFIRMAR" : "CORREO POR CONFIRMAR"}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-[12.5px]">
        <dt className="text-muted-foreground">De</dt>
        <dd>{correo.de}</dd>
        <dt className="text-muted-foreground">Para</dt>
        <dd className="break-all">{correo.para.join(", ")}</dd>
        {correo.cc.length > 0 && (
          <>
            <dt className="text-muted-foreground">Cc</dt>
            <dd className="break-all">{correo.cc.join(", ")}</dd>
          </>
        )}
      </dl>
      {editando ? (
        <div className="space-y-2">
          <input
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            aria-label="Asunto"
            disabled={correo.respuesta}
            className="w-full rounded-lg border bg-background px-2 py-1.5 text-[13.5px]"
          />
          <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} aria-label="Texto del correo" rows={10} className="w-full rounded-lg border bg-background px-2 py-1.5 text-[13.5px]" />
        </div>
      ) : (
        <p className="font-medium text-foreground">{asunto}</p>
      )}
      {/* Vista previa aislada: sin scripts ni navegación. */}
      <iframe title="Vista previa del correo" sandbox="" srcDoc={html} className="h-72 w-full rounded-lg border bg-white" />
      {resultado ? (
        <p role="status" className="text-[13px]">
          {resultado.mensaje}
        </p>
      ) : confirmar ? (
        <div className="space-y-2">
          <p className="text-[13px] text-foreground">
            Se envía ahora desde {correo.de} a {correo.para.join(", ")}.
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={ocupado} onClick={() => void resolver("enviar")}>
              {ocupado ? "Enviando" : "Confirmar envío"}
            </Button>
            <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setConfirmar(false)}>
              Volver
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {correo.puedeEnviar && (
            <Button size="sm" disabled={ocupado} onClick={() => setConfirmar(true)}>
              Enviar
            </Button>
          )}
          <Button size="sm" variant={correo.puedeEnviar ? "outline" : "default"} disabled={ocupado} onClick={() => void resolver("borrador")}>
            Guardar borrador
          </Button>
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setEditando((x) => !x)}>
            {editando ? "Listo" : "Editar"}
          </Button>
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => void resolver("cancelar")}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

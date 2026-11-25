"use client";

import { useState } from "react";
import { toast } from "sonner";
import { conectarAucoAccion } from "@/app/modulos/firma";
import { Button } from "@/components/ui/button";

/** Que Auco avise a Verse App cuando un contrato se firma (reemplaza el aviso de verse-docs). */
export function ConectarAuco({ configurado }: { configurado: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Firma de contratos (Auco)</p>
        <p className="text-xs text-muted-foreground">
          {configurado ? "Llaves cargadas. Conecta el aviso cuando no haya contratos esperando firma en verse-docs." : "Faltan AUCO_ENV, AUCO_PUK, AUCO_PRK y FIRMANTE_CELULAR en Vercel."}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={!configurado || ocupado}
        onClick={async () => {
          setOcupado(true);
          const r = await conectarAucoAccion();
          setOcupado(false);
          if (r.ok) toast.success(r.mensaje);
          else toast.error(r.mensaje);
        }}
      >
        Conectar aviso
      </Button>
    </div>
  );
}

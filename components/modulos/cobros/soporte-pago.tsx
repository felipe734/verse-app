"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { adjuntarSoporteAccion } from "@/app/modulos/cobros";
import { Button } from "@/components/ui/button";

/** Sube el comprobante de un arriendo. Si estaba POR PAGAR, el cobro queda PAGO con la fecha de hoy. */
export function SoportePago({ recId, pagado, alGuardar }: { recId: string; pagado: boolean; alGuardar: () => void }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);

  async function subir(f: File) {
    setOcupado(true);
    try {
      const b = await uploadPresigned(`cobros/${f.name.replace(/[^\w.-]/g, "_")}`, f, { access: "private", handleUploadUrl: "/api/cobros/soporte" });
      const r = await adjuntarSoporteAccion(recId, { ruta: b.pathname, nombre: f.name });
      if (r.ok) {
        toast.success(r.mensaje);
        alGuardar();
        router.refresh();
      } else toast.error(r.mensaje);
    } catch {
      toast.error("El soporte no subió. Intenta otra vez");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={entrada}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void subir(f);
        }}
      />
      <Button size="sm" variant={pagado ? "outline" : "default"} className="gap-1.5" disabled={ocupado} onClick={() => entrada.current?.click()}>
        <Paperclip className="size-4" aria-hidden /> {ocupado ? "Subiendo" : pagado ? "Agregar soporte" : "Subir soporte y marcar pagado"}
      </Button>
      {!pagado && <p className="text-xs text-muted-foreground">Queda PAGO con la fecha de hoy y tu nombre.</p>}
    </div>
  );
}

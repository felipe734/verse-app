"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { abrirCreacion, crearAccion } from "@/app/modulos/crear";
import type { RefModulo } from "@/app/modulos/editar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CampoNuevo } from "@/lib/modulos/crear";

const caja = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Botón y panel para crear un registro (gasto de caja menor) con la foto del soporte. */
export function CrearFila({ refModulo, titulo, subidas }: { refModulo: RefModulo; titulo: string; subidas: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [campos, setCampos] = useState<CampoNuevo[] | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [archivos, setArchivos] = useState<Record<string, File | null>>({});
  const [ocupado, setOcupado] = useState(false);

  async function abrir() {
    setAbierto(true);
    setCampos(null);
    const r = await abrirCreacion(refModulo);
    if ("error" in r) {
      toast.error(r.error);
      return setAbierto(false);
    }
    setCampos(r.campos);
    setValores(Object.fromEntries(r.campos.map((c) => [c.campo, c.defecto ?? ""])));
    setArchivos({});
  }

  async function guardar() {
    if (!campos) return;
    setOcupado(true);
    const datos: Record<string, unknown> = { ...valores };
    try {
      for (const c of campos.filter((x) => x.tipo === "archivo")) {
        const f = archivos[c.campo];
        delete datos[c.campo];
        if (!f) continue;
        const b = await uploadPresigned(`soportes/${refModulo.empresa}-${f.name.replace(/[^\w.-]/g, "_")}`, f, { access: "private", handleUploadUrl: "/api/finanzas/soporte", clientPayload: refModulo.empresa });
        datos[c.campo] = { ruta: b.pathname, nombre: f.name };
      }
    } catch {
      setOcupado(false);
      return void toast.error("El soporte no subió. Intenta otra vez");
    }
    const r = await crearAccion(refModulo, datos);
    setOcupado(false);
    if (r.ok) {
      toast.success(r.mensaje);
      setAbierto(false);
      router.refresh();
    } else toast.error(r.mensaje);
  }

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={abrir}>
        <Plus className="size-4" aria-hidden /> {titulo}
      </Button>
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>{titulo}</SheetTitle>
            <SheetDescription>Queda en Airtable y en AUDITORIA con tu nombre.</SheetDescription>
          </SheetHeader>
          {!campos ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando</p>
          ) : (
            <form
              aria-label={titulo}
              className="flex-1 space-y-3 overflow-y-auto p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void guardar();
              }}
            >
              {campos.map((c) => (
                <label key={c.campo} className="block space-y-1.5 text-sm">
                  <span className="font-medium">
                    {c.etiqueta}
                    {c.requerido && <span className="text-muted-foreground"> · obligatorio</span>}
                  </span>
                  {c.tipo === "opciones" ? (
                    <select className={caja} required={c.requerido} value={valores[c.campo] ?? ""} onChange={(e) => setValores((v) => ({ ...v, [c.campo]: e.target.value }))}>
                      <option value="">Elige</option>
                      {c.opciones?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : c.tipo === "archivo" ? (
                    subidas ? (
                      <input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setArchivos((a) => ({ ...a, [c.campo]: e.target.files?.[0] ?? null }))} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5" />
                    ) : (
                      <span className="block text-muted-foreground">Las fotos todavía no están activadas. Súbela en Airtable.</span>
                    )
                  ) : (
                    <input
                      className={caja}
                      required={c.requerido}
                      type={c.tipo === "fecha" ? "date" : "text"}
                      inputMode={c.tipo === "numero" ? "numeric" : undefined}
                      value={valores[c.campo] ?? ""}
                      onChange={(e) => setValores((v) => ({ ...v, [c.campo]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
              <SheetFooter className="px-0">
                <Button type="submit" disabled={ocupado}>
                  {ocupado && <Loader2 className="size-4 animate-spin" aria-hidden />} Guardar
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

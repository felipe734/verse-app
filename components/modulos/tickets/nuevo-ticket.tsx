"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { crearTicketAccion, unidadesParaTicket } from "@/app/modulos/tickets";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const caja = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TIPOS = ["Daño", "Faltante", "Implementos", "Mantenimiento", "Huésped", "Otro"];
const VACIO = { titulo: "", unidad: "", tipo: "Daño", prioridad: "Media", responsable: "", fechaLimite: "", comentario: "" };

/** Abrir un ticket a mano: título, unidad, tipo, prioridad, responsable y límite (si no, sale de la prioridad). */
export function NuevoTicket() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [unidades, setUnidades] = useState<{ recId: string; nombre: string }[] | null>(null);
  const [f, setF] = useState(VACIO);
  const [ocupado, setOcupado] = useState(false);

  function abrir() {
    setAbierto(true);
    setF(VACIO);
    if (!unidades)
      void unidadesParaTicket().then((r) => {
        if ("error" in r) {
          toast.error(r.error);
          return setAbierto(false);
        }
        setUnidades(r);
      });
  }

  async function guardar() {
    setOcupado(true);
    const r = await crearTicketAccion(f);
    setOcupado(false);
    if (!r.ok) return void toast.error(r.mensaje);
    toast.success(r.mensaje);
    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={abrir}>
        <Plus className="size-4" aria-hidden /> Nuevo ticket
      </Button>
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Nuevo ticket</SheetTitle>
            <SheetDescription>Queda en TICKETS y en la actividad con tu nombre.</SheetDescription>
          </SheetHeader>
          <form
            aria-label="Nuevo ticket"
            className="flex-1 space-y-3 overflow-y-auto p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
          >
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Qué pasa</span>
              <input className={caja} required minLength={3} maxLength={200} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ducha sin agua caliente" />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Unidad</span>
              <select className={caja} value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })} disabled={!unidades}>
                <option value="">{unidades ? "Sin unidad" : "Cargando…"}</option>
                {unidades?.map((u) => (
                  <option key={u.recId} value={u.recId}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Tipo</span>
                <select className={caja} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                  {TIPOS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <div className="space-y-1.5 text-sm">
                <span className="font-medium">Prioridad</span>
                <div role="radiogroup" aria-label="Prioridad" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                  {["Alta", "Media", "Baja"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={f.prioridad === p}
                      onClick={() => setF({ ...f, prioridad: p })}
                      className={cn("rounded-md px-1 py-1.5 text-xs", f.prioridad === p ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Responsable</span>
                <input className={caja} maxLength={100} value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })} placeholder="Diana" />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Límite</span>
                <input className={caja} type="date" value={f.fechaLimite} onChange={(e) => setF({ ...f, fechaLimite: e.target.value })} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Sin límite: Alta 1 día, Media 3, Baja 7.</p>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Detalle</span>
              <textarea className={cn(caja, "min-h-24")} maxLength={5000} value={f.comentario} onChange={(e) => setF({ ...f, comentario: e.target.value })} />
            </label>
            <Button type="submit" className="w-full" disabled={ocupado}>
              {ocupado && <Loader2 className="size-4 animate-spin" aria-hidden />} Abrir ticket
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

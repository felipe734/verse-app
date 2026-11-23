"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Botón que abre un diálogo con un formulario de Ajustes. */
export function Dialogo({ boton, titulo, descripcion, children }: { boton: string; titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 bg-acento text-acento-foreground hover:bg-acento/90">
          <Plus className="size-4" aria-hidden /> {boton}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

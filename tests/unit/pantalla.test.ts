import { describe, expect, it } from "vitest";
import { describirPantalla } from "@/lib/asistente/pantalla";

describe("contexto de pantalla para el asistente", () => {
  it("describe módulo, período, filtros, vista, Mío y fila abierta", () => {
    const d = describirPantalla("/verse/host/limpiezas?p=2026-W48&f.Estado=Programado&v=tablero&quien=mio", "Limpiezas Torre 603 (Limpiezas)", "2026-11-25");
    expect(d).toBe("Pantalla: /verse/host/limpiezas · módulo Limpiezas (verse) · período 23 al 29 de noviembre · filtros: Estado = Programado · vista tablero · solo lo suyo · fila abierta: Limpiezas Torre 603 (Limpiezas).");
  });
  it("en Finanzas usa la pestaña y su período", () => {
    expect(describirPantalla("/verse/general/finanzas?pestana=caja", null, "2026-11-25")).toContain("período noviembre 2026 · pestaña caja");
  });
});

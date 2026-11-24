import { describe, expect, it } from "vitest";
import { usoDesde, registrarTiempo, registrarUso } from "@/lib/medicion/uso";
import { usuarios } from "@/db/esquema";
import { dbDePrueba } from "../apoyo/db";

describe("uso de pantallas", () => {
  it("suma visitas por persona, pantalla y día", async () => {
    const db = await dbDePrueba();
    const [u] = await db.insert(usuarios).values({ correo: "uso@prueba.test", nombre: "Uso" }).returning();
    await registrarUso(db, u!.id, "/inicio", "2026-11-23");
    await registrarUso(db, u!.id, "/inicio", "2026-11-23");
    await registrarUso(db, u!.id, "/verse/host/limpiezas", "2026-11-22");
    const r = await usoDesde(db, "2026-11-20");
    expect(r.porPantalla[0]).toEqual({ ruta: "/inicio", vistas: 2, personas: 1, msPromedio: null, msMax: 0 });
    expect(r.porPersona).toEqual([{ nombre: "Uso", correo: "uso@prueba.test", vistas: 3, dias: 2 }]);
  });

  it("promedia el tiempo de carga y guarda el máximo", async () => {
    const db = await dbDePrueba();
    const [u] = await db.insert(usuarios).values({ correo: "tiempo@prueba.test", nombre: "Tiempo" }).returning();
    await registrarUso(db, u!.id, "/verse/host/limpiezas", "2026-11-24");
    await registrarTiempo(db, u!.id, "/verse/host/limpiezas", "2026-11-24", 800);
    await registrarUso(db, u!.id, "/verse/host/limpiezas", "2026-11-24");
    await registrarTiempo(db, u!.id, "/verse/host/limpiezas", "2026-11-24", 1400.4);
    const r = await usoDesde(db, "2026-11-24");
    expect(r.porPantalla[0]).toEqual({ ruta: "/verse/host/limpiezas", vistas: 2, personas: 1, msPromedio: 1100, msMax: 1400 });
  });
});

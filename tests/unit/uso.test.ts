import { describe, expect, it } from "vitest";
import { usoDesde, registrarUso } from "@/lib/medicion/uso";
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
    expect(r.porPantalla[0]).toEqual({ ruta: "/inicio", vistas: 2, personas: 1 });
    expect(r.porPersona).toEqual([{ nombre: "Uso", correo: "uso@prueba.test", vistas: 3, dias: 2 }]);
  });
});

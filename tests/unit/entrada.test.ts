import { describe, expect, it } from "vitest";
import { usuarios } from "@/db/esquema";
import { decidirEntrada } from "@/lib/acceso/entrada";
import { dbDePrueba } from "../apoyo/db";

describe("entrada con Google", () => {
  it("solo entra un usuario activo, sin importar mayúsculas", async () => {
    const db = await dbDePrueba();
    await db.insert(usuarios).values({ nombre: "Activa", correo: "activa@prueba.co", estado: "activo" });
    const r = await decidirEntrada(db, "Activa@Prueba.co", true);
    expect(r.ok).toBe(true);
    const [u] = await db.select().from(usuarios);
    expect(u?.ultimoIngreso).not.toBeNull();
  });

  it("una cuenta de Google sin invitación no entra", async () => {
    const db = await dbDePrueba();
    expect(await decidirEntrada(db, "extrano@gmail.com", true)).toEqual({ ok: false, motivo: "sin-invitacion" });
  });

  it("suspendido no entra, ni invitado sin usar su enlace", async () => {
    const db = await dbDePrueba();
    await db.insert(usuarios).values([
      { nombre: "S", correo: "s@prueba.co", estado: "suspendido", maestro: true },
      { nombre: "I", correo: "i@prueba.co", estado: "invitado" },
    ]);
    expect(await decidirEntrada(db, "s@prueba.co", true)).toEqual({ ok: false, motivo: "suspendido" });
    expect(await decidirEntrada(db, "i@prueba.co", true)).toEqual({ ok: false, motivo: "invitacion-pendiente" });
  });

  it("sin correo o con correo no verificado no entra", async () => {
    const db = await dbDePrueba();
    await db.insert(usuarios).values({ nombre: "A", correo: "a@prueba.co", estado: "activo" });
    expect(await decidirEntrada(db, null, true)).toEqual({ ok: false, motivo: "sin-correo" });
    expect(await decidirEntrada(db, "a@prueba.co", false)).toEqual({ ok: false, motivo: "no-verificado" });
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { rutaValida, subidasActivas } = await import("@/lib/servidor/blob");

describe("almacén de archivos", () => {
  it("solo acepta rutas dentro de su carpeta", () => {
    expect(rutaValida("servicios/rec123-video-AbC.mp4", "servicios")).toBe(true);
    expect(rutaValida("soportes/verse-foto.jpg", "servicios")).toBe(false);
    expect(rutaValida("servicios/../soportes/x", "servicios")).toBe(false);
    expect(rutaValida("/servicios/x", "servicios")).toBe(false);
    expect(rutaValida(42, "servicios")).toBe(false);
  });

  it("se activa con el almacén conectado por OIDC o con token", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("BLOB_STORE_ID", "");
    expect(subidasActivas()).toBe(false);
    vi.stubEnv("BLOB_STORE_ID", "store_prueba");
    expect(subidasActivas()).toBe(true);
    vi.unstubAllEnvs();
  });
});

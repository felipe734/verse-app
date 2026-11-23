import type { ArchivoDrive, Drive } from "@/lib/google/drive";

/** Drive en memoria: carpetas y archivos con su padre. */
export class DriveFalso implements Drive {
  carpetasPorId = new Map<string, { name: string; padre: string; papelera: boolean }>();
  archivos: { name: string; padre: string; contenido: string; tipo: string }[] = [];
  fallarSubida: string | null = null;
  private n = 0;

  async carpeta(nombre: string, padre: string) {
    for (const [id, c] of this.carpetasPorId) if (c.name === nombre && c.padre === padre && !c.papelera) return id;
    const id = `carpeta${++this.n}`;
    this.carpetasPorId.set(id, { name: nombre, padre, papelera: false });
    return id;
  }
  async carpetas(padre: string): Promise<ArchivoDrive[]> {
    return [...this.carpetasPorId].filter(([, c]) => c.padre === padre && !c.papelera).map(([id, c]) => ({ id, name: c.name }));
  }
  async subir(nombre: string, padre: string, contenido: Uint8Array | string, tipo: string) {
    if (this.fallarSubida && nombre.startsWith(this.fallarSubida)) throw new Error("Drive respondió 500");
    this.archivos.push({ name: nombre, padre, contenido: typeof contenido === "string" ? contenido : "<bytes>", tipo });
    return `archivo${++this.n}`;
  }
  async aPapelera(id: string) {
    const c = this.carpetasPorId.get(id);
    if (c) c.papelera = true;
  }
  ruta(padre: string): string {
    const c = this.carpetasPorId.get(padre);
    return c ? `${this.ruta(c.padre)}/${c.name}` : padre;
  }
}

/** Sección en tarjeta de las pantallas de Ajustes. */
export function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-medium">{titulo}</h2>
        {descripcion && <p className="text-xs text-muted-foreground">{descripcion}</p>}
      </header>
      <div className="space-y-4 p-4 text-sm">{children}</div>
    </section>
  );
}

/** Título del módulo bajo la barra superior: nombre, una línea de contexto y acciones propias. */
export function EncabezadoModulo({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-6 pb-4 md:px-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {children}
    </div>
  );
}

/** Esqueleto mientras carga un módulo. */
export function EsqueletoModulo() {
  return (
    <div className="animate-pulse space-y-3 px-4 pt-6 md:px-6" aria-busy="true" aria-label="Cargando">
      <div className="h-6 w-40 rounded-md bg-muted" />
      <div className="h-4 w-64 rounded-md bg-muted" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-11 rounded-md bg-muted/70" />
        ))}
      </div>
    </div>
  );
}

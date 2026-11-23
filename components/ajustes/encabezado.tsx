/**
 * Piezas de las pantallas que aún no tienen su PR de rediseño (Correo, Sistema, Ajustes).
 * Ya viven dentro del shell: aquí solo dan título y espaciado neutros.
 */
export function Encabezado({ submarca }: { submarca: string }) {
  const titulo = submarca.charAt(0) + submarca.slice(1).toLowerCase();
  return (
    <div className="px-4 pt-6 pb-2 md:px-6">
      <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
    </div>
  );
}

export function Tarjeta({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6 px-4 pb-10 text-sm leading-relaxed md:px-6">{children}</div>;
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground">{titulo}</h2>
      {children}
    </section>
  );
}

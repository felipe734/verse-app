import Link from "next/link";

/** Franja Navy de las pantallas privadas. */
export function Encabezado({ submarca }: { submarca: string }) {
  return (
    <header className="flex items-center justify-between rounded-t-2xl bg-primary px-6 py-4">
      <Link href="/hoy" className="font-display text-sm font-bold tracking-[4px] text-primary-foreground">
        VERSE<span className="ml-2.5 text-xs tracking-[2px] text-[#a9b8cc]">{submarca}</span>
      </Link>
      <span aria-hidden className="size-[9px] rounded-full bg-[var(--verse-naranja)]" />
    </header>
  );
}

export function Tarjeta({ children }: { children: React.ReactNode }) {
  return (
    <article className="space-y-6 rounded-b-2xl border border-t-0 bg-card px-6 py-6 text-[14.5px] leading-relaxed text-[var(--verse-parrafo)]">
      {children}
    </article>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-[11px] tracking-[1.6px] text-muted-foreground">{titulo.toUpperCase()}</h2>
      {children}
    </section>
  );
}

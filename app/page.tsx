export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6">
      <header className="flex items-center justify-between rounded-t-2xl bg-primary px-6 py-4">
        <span className="font-display text-sm font-bold tracking-[4px] text-primary-foreground">
          VERSE<span className="ml-2.5 text-xs tracking-[2px] text-[#a9b8cc]">APP</span>
        </span>
        <span aria-hidden className="size-[9px] rounded-full bg-[var(--verse-naranja)]" />
      </header>
      <section className="rounded-b-2xl border border-t-0 bg-card px-6 py-6">
        <p className="font-display text-[11px] tracking-[1.6px] text-muted-foreground">ENTREGA 0</p>
        <h1 className="mt-1.5 font-display text-[28px] leading-tight font-medium tracking-tight">
          Cimientos
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--verse-parrafo)]">
          La app está en construcción. Aquí llegarán Hoy, Para aprobar y Sistema.
        </p>
      </section>
    </main>
  );
}

import Link from "next/link";

/** Marco de las páginas públicas con la marca Verse: franja Navy, tarjeta blanca y pie con la política. */
export function Marco({ rotulo, titulo, children }: { rotulo: string; titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <header className="flex items-center justify-between rounded-t-2xl bg-primary px-6 py-4">
        <Link href="/" className="font-display text-sm font-bold tracking-[4px] text-primary-foreground">
          VERSE<span className="ml-2.5 text-xs tracking-[2px] text-[#a9b8cc]">APP</span>
        </Link>
        <span aria-hidden className="size-[9px] rounded-full bg-[var(--verse-naranja)]" />
      </header>
      <article className="space-y-5 rounded-b-2xl border border-t-0 bg-card px-6 py-6 text-[14.5px] leading-relaxed text-[var(--verse-parrafo)]">
        <div>
          <p className="font-display text-[11px] tracking-[1.6px] text-muted-foreground">{rotulo}</p>
          <h1 className="mt-1.5 font-display text-[28px] leading-tight font-medium tracking-tight text-foreground">{titulo}</h1>
        </div>
        {children}
      </article>
      <footer className="mt-4 flex justify-between px-2 font-display text-[11.5px] text-[#8a98a6]">
        <span>Verse Group · C&amp;C Group</span>
        <Link href="/privacidad" className="underline">
          Política de privacidad
        </Link>
      </footer>
    </main>
  );
}

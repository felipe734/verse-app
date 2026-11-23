import Link from "next/link";
import { PLATFORM_NAME } from "@/lib/config";

/** Marco de las páginas públicas (inicio, entrar, invitación, privacidad): neutro, centrado. */
export function Marco({ rotulo, titulo, children }: { rotulo: string; titulo: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="flex size-7 items-center justify-center rounded-md bg-primary text-[12px] text-primary-foreground">
            {PLATFORM_NAME.charAt(0)}
          </span>
          {PLATFORM_NAME}
        </Link>
        <article className="space-y-5 rounded-lg border bg-card p-6 text-sm leading-relaxed text-muted-foreground shadow-xs">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{titulo}</h1>
          </div>
          {children}
        </article>
        <footer className="mt-4 flex justify-between px-1 text-xs text-muted-foreground">
          <span>Verse Group · C&amp;C Group</span>
          <Link href="/privacidad" className="hover:text-foreground hover:underline">
            Política de privacidad
          </Link>
        </footer>
      </div>
    </main>
  );
}

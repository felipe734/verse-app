import Link from "next/link";

export default function NoEncontrada() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-24 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">No encontramos esta página</h1>
      <p className="text-sm text-muted-foreground">No existe o tu acceso no la incluye.</p>
      <Link href="/hoy" className="text-sm underline underline-offset-2">
        Ir a Hoy
      </Link>
    </div>
  );
}

import { cn } from "@/lib/utils";

/** Logo de la empresa, o su inicial sobre el color de acento si no tiene logo. */
export function LogoEmpresa({ nombre, logo, acento, className }: { nombre: string; logo: string | null; acento: string; className?: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className={cn("size-6 rounded-md object-cover", className)} />;
  }
  const inicial = nombre.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "").charAt(0).toUpperCase() || "·";
  return (
    <span aria-hidden className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-[12px] font-semibold text-white", className)} style={{ backgroundColor: acento }}>
      {inicial}
    </span>
  );
}

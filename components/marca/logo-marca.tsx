import { Logo } from "@/components/marca/logo";
import type { Marca } from "@/lib/dominio/contexto";
import { cn } from "@/lib/utils";

/** Logo de la empresa (imagen o nombre) o, en el dominio de la plataforma, el de la plataforma. */
export function LogoMarca({ marca, className }: { marca: Marca; className?: string }) {
  if (marca.plataforma) return <Logo nombre={marca.nombre} logoUrl={marca.logoUrl} className={className} />;
  if (marca.logoUrl) {
    return (
      // Imagen de Storage de tamaño libre: <img> simple, sin optimizar.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={marca.logoUrl} alt={marca.nombre} className={cn("h-7 w-auto max-w-44 object-contain", className)} />
    );
  }
  return <span className={cn("text-base font-semibold tracking-tight", className)}>{marca.nombre}</span>;
}

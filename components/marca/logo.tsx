import { cn } from "@/lib/utils";

/** Símbolo: cinco barras de una onda de voz, de puntos en la última. */
export function Simbolo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6", className)} fill="currentColor">
      <rect x="2" y="9" width="2.4" height="6" rx="1.2" />
      <rect x="6.4" y="5" width="2.4" height="14" rx="1.2" />
      <rect x="10.8" y="2" width="2.4" height="20" rx="1.2" />
      <rect x="15.2" y="6.5" width="2.4" height="11" rx="1.2" />
      <circle cx="20.8" cy="9.2" r="1.2" />
      <circle cx="20.8" cy="12" r="1.2" />
      <circle cx="20.8" cy="14.8" r="1.2" />
    </svg>
  );
}

/**
 * Logo de la plataforma: la imagen subida en /admin → Marca o, si no hay,
 * el símbolo + el nombre en versalitas espaciadas. Recibe la marca por props
 * porque también lo pinta la cabecera, que es un componente de cliente.
 */
export function Logo({ nombre, logoUrl, className }: { nombre: string; logoUrl?: string | null; className?: string }) {
  if (logoUrl) {
    return (
      // Imagen de Storage de tamaño libre: <img> simple, sin optimizar.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={nombre} className={cn("h-7 w-auto max-w-44 object-contain", className)} />
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Simbolo className="text-marca-600" />
      <span className="text-[13px] font-medium tracking-[0.28em] uppercase">{nombre}</span>
    </span>
  );
}

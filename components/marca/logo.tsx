import { cn } from "@/lib/utils";
import { MARCA } from "@/lib/marca";

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

/** Símbolo + nombre en versalitas espaciadas. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Simbolo />
      <span className="text-[13px] font-medium tracking-[0.28em] uppercase">{MARCA.nombre}</span>
    </span>
  );
}

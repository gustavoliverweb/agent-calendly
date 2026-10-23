import { cn } from "@/lib/utils";
import { COLOR_ESTADO, ETIQUETA_ESTADO, type ContactoEstado } from "@/lib/contacts/estados";

export function EstadoBadge({ estado, className }: { estado: ContactoEstado; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        COLOR_ESTADO[estado],
        className,
      )}
    >
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}

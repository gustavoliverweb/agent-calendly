import { cn } from "@/lib/utils";
import { COLOR_LLAMADA, ETIQUETA_LLAMADA, type LlamadaEstado } from "@/lib/calls/estados";

export function EstadoLlamada({ estado, className }: { estado: LlamadaEstado; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        COLOR_LLAMADA[estado],
        className,
      )}
    >
      {(estado === "iniciada" || estado === "en_curso") && (
        <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      )}
      {ETIQUETA_LLAMADA[estado]}
    </span>
  );
}

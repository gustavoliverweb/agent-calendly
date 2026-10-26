import { COLOR_ITEM, ETIQUETA_ITEM, type ItemEstado, type Progreso } from "@/lib/lotes/estados";
import { cn } from "@/lib/utils";

const ORDEN: ItemEstado[] = ["completado", "fallido", "omitido", "en_llamada", "esperando_reintento", "en_cola"];
const BARRA: Record<ItemEstado, string> = {
  completado: "bg-green-500",
  fallido: "bg-red-400",
  omitido: "bg-muted-foreground/40",
  en_llamada: "bg-blue-500",
  esperando_reintento: "bg-amber-400",
  en_cola: "bg-muted",
};

/** Barra apilada + recuento por estado del item. */
export function ProgresoLote({ progreso, detalle = false }: { progreso: Progreso; detalle?: boolean }) {
  const terminados = progreso.completado + progreso.fallido + progreso.omitido;
  return (
    <div className="flex min-w-40 flex-col gap-1.5">
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${terminados} de ${progreso.total} terminados`}
      >
        {ORDEN.map((e) =>
          progreso[e] ? (
            <div key={e} className={BARRA[e]} style={{ width: `${(progreso[e] / progreso.total) * 100}%` }} />
          ) : null,
        )}
      </div>
      {detalle ? (
        <ul className="flex flex-wrap gap-1.5">
          {ORDEN.filter((e) => progreso[e]).map((e) => (
            <li key={e} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", COLOR_ITEM[e])}>
              {ETIQUETA_ITEM[e]}: {progreso[e]}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-xs text-muted-foreground tabular-nums">
          {terminados}/{progreso.total} terminados
          {progreso.en_llamada ? ` · ${progreso.en_llamada} en llamada` : ""}
          {progreso.esperando_reintento ? ` · ${progreso.esperando_reintento} esperando reintento` : ""}
        </span>
      )}
    </div>
  );
}

export function EstadoLoteBadge({ clase, children }: { clase: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", clase)}>{children}</span>;
}

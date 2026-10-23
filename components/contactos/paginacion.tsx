import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Paginacion({
  pagina,
  total,
  porPagina,
  params,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  params: Record<string, string>;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const href = (p: number) => `?${new URLSearchParams({ ...params, pagina: String(p) })}`;
  const desde = total ? (pagina - 1) * porPagina + 1 : 0;
  const hasta = Math.min(pagina * porPagina, total);

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {desde}–{hasta} de {total}
      </span>
      <div className="flex gap-2">
        <Link
          href={href(pagina - 1)}
          aria-disabled={pagina <= 1}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), pagina <= 1 && "pointer-events-none opacity-50")}
        >
          <ChevronLeftIcon data-icon="inline-start" />
          Anterior
        </Link>
        <Link
          href={href(pagina + 1)}
          aria-disabled={pagina >= paginas}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), pagina >= paginas && "pointer-events-none opacity-50")}
        >
          Siguiente
          <ChevronRightIcon data-icon="inline-end" />
        </Link>
      </div>
    </div>
  );
}

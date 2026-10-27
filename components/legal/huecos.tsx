import type { ReactNode } from "react";
import { ETIQUETAS, TEXTOS_REVISADOS, TITULAR, type CampoTitular } from "@/lib/legal";

const marca =
  "rounded-sm border border-dashed border-amber-500 bg-amber-50 px-1 font-mono text-[0.8em] text-amber-900 [box-decoration-break:clone]";

/** Dato del titular, o un hueco marcado si aún no está en lib/legal.ts. */
export function Dato({ campo }: { campo: CampoTitular }) {
  const valor = TITULAR[campo];
  if (valor) return <>{valor}</>;
  return <mark className={marca}>[{ETIQUETAS[campo]}]</mark>;
}

/**
 * Punto del texto que debe confirmar el titular o su asesor. Desaparece la
 * marca (queda el texto) cuando TEXTOS_REVISADOS es true.
 */
export function Revisar({ children, nota }: { children: ReactNode; nota: string }) {
  if (TEXTOS_REVISADOS) return <>{children}</>;
  return (
    <mark className="bg-amber-100/70 text-inherit [box-decoration-break:clone]" title={`Revisar: ${nota}`}>
      {children}
      <span className={`${marca} ml-1`}>[Revisar: {nota}]</span>
    </mark>
  );
}

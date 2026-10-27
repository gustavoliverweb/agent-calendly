import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ACTUALIZACION_LEGAL, ETIQUETAS, huecosPendientes, legalEsBorrador, TEXTOS_REVISADOS } from "@/lib/legal";
import { cn } from "@/lib/utils";

export const DOCUMENTOS_LEGALES = [
  { href: "/aviso-legal", texto: "Aviso legal" },
  { href: "/privacidad", texto: "Privacidad" },
  { href: "/cookies", texto: "Cookies" },
] as const;

type RutaLegal = (typeof DOCUMENTOS_LEGALES)[number]["href"];

/** Metadatos comunes: sin indexar mientras el texto sea un borrador. */
export function metadataLegal(title: string, description: string): Metadata {
  return { title, description, ...(legalEsBorrador() ? { robots: { index: false, follow: false } } : {}) };
}

const etiqueta = "font-mono text-[11px] tracking-[0.22em] uppercase";

// Tipografía del cuerpo sin plugin: los documentos son HTML semántico plano.
const cuerpo = cn(
  "text-[15px] leading-relaxed text-neutral-700",
  "[&_h2]:mt-14 [&_h2]:scroll-mt-28 [&_h2]:text-2xl [&_h2]:tracking-[-0.03em] [&_h2]:text-neutral-950 [&_h2:first-child]:mt-0",
  "[&_h3]:mt-8 [&_h3]:text-lg [&_h3]:tracking-[-0.02em] [&_h3]:text-neutral-950",
  "[&_p]:mt-4 [&_ul]:mt-4 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5",
  "[&_a]:text-neutral-950 [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-medium [&_strong]:text-neutral-950",
  "[&_table]:mt-5 [&_table]:w-full [&_table]:text-left [&_table]:text-sm",
  "[&_th]:border-b [&_th]:border-neutral-200 [&_th]:py-3 [&_th]:pr-4 [&_th]:align-top [&_th]:font-mono [&_th]:text-[11px] [&_th]:font-normal [&_th]:tracking-[0.14em] [&_th]:text-neutral-500 [&_th]:uppercase",
  "[&_thead_th]:border-neutral-950 [&_thead_th]:py-2 [&_tbody_th]:w-32 [&_tbody_th]:pt-[0.95rem]",
  "[&_td]:border-b [&_td]:border-neutral-200 [&_td]:py-3 [&_td]:pr-4 [&_td]:align-top",
);

export function DocumentoLegal({ ruta, titulo, children }: { ruta: RutaLegal; titulo: string; children: ReactNode }) {
  const pendientes = huecosPendientes();

  return (
    <main className="flex-1 bg-white px-6 pt-20 pb-24 text-neutral-950 sm:pt-28 lg:pb-36">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_2.2fr]">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <p className={cn(etiqueta, "text-neutral-500")}>Legal</p>
          <nav aria-label="Documentos legales" className="mt-5 flex flex-wrap gap-2 lg:flex-col lg:items-start">
            {DOCUMENTOS_LEGALES.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                aria-current={d.href === ruta ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
                  d.href === ruta
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-950 hover:text-neutral-950",
                )}
              >
                {d.texto}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <h1 className="text-[clamp(2.5rem,5vw,4.25rem)] leading-[1] font-normal tracking-[-0.045em] text-balance">{titulo}</h1>
          <p className={cn(etiqueta, "mt-6 text-neutral-400")}>Última actualización · {ACTUALIZACION_LEGAL}</p>

          {legalEsBorrador() && (
            <div role="note" className="mt-10 rounded-2xl border border-dashed border-amber-500 bg-amber-50 p-5 text-sm text-amber-950">
              <p className="font-medium">Borrador: esta página no se indexa hasta completarla.</p>
              {pendientes.length > 0 && (
                <p className="mt-2">
                  Faltan en <code className="font-mono text-[0.9em]">lib/legal.ts</code>:{" "}
                  {pendientes.map((c) => ETIQUETAS[c]).join(", ")}.
                </p>
              )}
              {!TEXTOS_REVISADOS && (
                <p className="mt-2">
                  Los puntos marcados con «Revisar» necesitan confirmación del titular o de su asesor; después, pon{" "}
                  <code className="font-mono text-[0.9em]">TEXTOS_REVISADOS = true</code>.
                </p>
              )}
            </div>
          )}

          <div className={cn(cuerpo, "mt-12")}>{children}</div>
        </article>
      </div>
    </main>
  );
}

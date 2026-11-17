import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { CtaFinal, Hero, Seccion } from "@/components/landing/bloques";
import { etiqueta } from "@/components/landing/estilos";
import { RECURSOS } from "@/lib/contenido/recursos";
import { MARCA } from "@/lib/marca";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Recursos",
  description: `Guías prácticas para empezar con ${MARCA.nombre}: qué necesitas, cómo escribir el guion del agente y cómo preparar tu lista de contactos.`,
  alternates: { canonical: "/recursos" },
};

export default function RecursosPage() {
  return (
    <main className="bg-white text-neutral-950">
      <Hero
        etiqueta="Recursos"
        titulo="Guías para sacarle partido."
        destacado="Sin rodeos."
        texto={<p>Lo que conviene saber antes de lanzar tu primera campaña, explicado paso a paso.</p>}
        onda={false}
      />

      <Seccion etiqueta="Guías" titulo="Empieza por aquí.">
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/recursos/${r.slug}`}
                className="group flex h-full flex-col rounded-3xl border border-neutral-200 p-7 transition-colors hover:border-neutral-950 sm:p-8"
              >
                <span className={cn(etiqueta, "flex items-center justify-between text-marca-600")}>
                  {r.categoria}
                  <ArrowUpRightIcon className="size-5 text-neutral-400 transition-colors group-hover:text-marca-600" />
                </span>
                <span className="mt-8 text-2xl tracking-[-0.03em]">{r.titulo}</span>
                <span className="mt-3 flex-1 leading-relaxed text-neutral-600">{r.resumen}</span>
                <span className="mt-8 font-mono text-xs text-neutral-400">{r.lectura} min de lectura</span>
              </Link>
            </li>
          ))}
        </ul>
      </Seccion>

      <CtaFinal
        titulo="¿Prefieres que te lo contemos?"
        destacado="Te lo enseñamos en una demo."
        origen="/recursos"
        secundaria={{ href: "/producto", texto: "Ver el producto" }}
      />
    </main>
  );
}

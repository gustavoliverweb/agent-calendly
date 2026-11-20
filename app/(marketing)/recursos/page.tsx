import type { Metadata } from "next";
import Link from "next/link";
import { CtaFinal, Hero, Seccion } from "@/components/landing/bloques";
import { RECURSOS } from "@/lib/contenido/recursos";
import { marcaPlataforma } from "@/lib/marca-plataforma";

export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaPlataforma();
  return {
    title: "Recursos",
    description: `Guías prácticas para empezar con ${marca.nombre}: qué necesitas, cómo escribir el guion del agente y cómo preparar tu lista de contactos.`,
    alternates: { canonical: "/recursos" },
  };
}

export default function RecursosPage() {
  return (
    <main className="bg-white">
      <Hero
        titulo="Guías para empezar con buen pie."
        texto={<p>Lo que conviene saber antes de lanzar tu primera campaña, explicado paso a paso.</p>}
        onda={false}
      />

      <Seccion apilada titulo="Empieza por aquí.">
        <ul className="border-b border-carbon/10">
          {RECURSOS.map((r) => (
            <li key={r.slug} className="border-t border-carbon/10">
              <Link
                href={`/recursos/${r.slug}`}
                className="group grid gap-2 py-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16"
              >
                <span className="text-[15px]">
                  <span className="block text-marca-700">{r.categoria}</span>
                  <span className="block text-ceniza">{r.lectura} min de lectura</span>
                </span>
                <span>
                  <span className="block text-[31px] leading-tight font-semibold tracking-[-0.025em] underline decoration-marca-600/0 decoration-2 underline-offset-[6px] transition-colors [font-stretch:86%] group-hover:decoration-marca-600">
                    {r.titulo}
                  </span>
                  <span className="mt-2 block max-w-2xl text-[17px] leading-relaxed text-ceniza">{r.resumen}</span>
                </span>
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

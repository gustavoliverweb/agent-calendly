import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CtaFinal, Dialogo, Hero, Lista, Pasos, Preguntas, Seccion } from "@/components/landing/bloques";
import { solucionPorSlug, SOLUCIONES } from "@/lib/contenido/soluciones";

/** Páginas por sector o caso de uso. El contenido está en lib/contenido/soluciones.ts. */

export function generateStaticParams() {
  return SOLUCIONES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/soluciones/[slug]">): Promise<Metadata> {
  const s = solucionPorSlug((await params).slug);
  if (!s) return {};
  return { title: s.seo.titulo, description: s.seo.descripcion, alternates: { canonical: `/soluciones/${s.slug}` } };
}

/**
 * Con Partial Prefetching, params se lee dentro de <Suspense>: así Next puede
 * regenerar la página (al cambiar la marca o cada hora) sin error 500. Los
 * slugs que no existen ya los corta el proxy con un 404 de verdad.
 */
export default function SolucionPage({ params }: PageProps<"/soluciones/[slug]">) {
  return (
    <Suspense fallback={<main className="flex-1 bg-white" />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: Pick<PageProps<"/soluciones/[slug]">, "params">) {
  const s = solucionPorSlug((await params).slug);
  if (!s) notFound();
  const contacto = `/contacto?origen=${encodeURIComponent(`/soluciones/${s.slug}`)}&sector=${encodeURIComponent(s.sector)}`;

  return (
    <main className="bg-white">
      <Hero
        etiqueta={s.hero.etiqueta}
        titulo={s.hero.titulo}
        destacado={s.hero.destacado}
        texto={<p>{s.hero.texto}</p>}
        principal={{ href: contacto, texto: "Solicitar una demo" }}
        secundaria={{ href: "#como-funciona", texto: "Ver cómo funciona" }}
      />

      <Seccion titulo={s.problema.titulo} destacado={s.problema.destacado}>
        <Lista items={s.problema.items} />
      </Seccion>

      <Seccion id="como-funciona" titulo={s.pasos.titulo} destacado={s.pasos.destacado}>
        <Pasos items={s.pasos.items} />
      </Seccion>

      {s.dialogo && (
        <Seccion oscuro titulo={s.dialogo.titulo} texto={<p>{s.dialogo.texto}</p>}>
          <Dialogo titulo={s.dialogo.conversacion.titulo} turnos={s.dialogo.conversacion.turnos} />
        </Seccion>
      )}

      <Seccion titulo={s.beneficios.titulo} destacado={s.beneficios.destacado}>
        <Lista items={s.beneficios.items} />
      </Seccion>

      <Preguntas items={s.preguntas} />

      <CtaFinal titulo={s.cta.titulo} destacado={s.cta.destacado} origen={`/soluciones/${s.slug}`} />
    </main>
  );
}

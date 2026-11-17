import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CtaFinal, Dialogo, Hero, Pasos, Preguntas, Seccion, Tarjetas } from "@/components/landing/bloques";
import { etiqueta, titular } from "@/components/landing/estilos";
import { OndaPuntos } from "@/components/landing/onda-puntos";
import { solucionPorSlug, SOLUCIONES } from "@/lib/contenido/soluciones";
import { cn } from "@/lib/utils";

/** Páginas por sector o caso de uso. El contenido está en lib/contenido/soluciones.ts. */

export function generateStaticParams() {
  return SOLUCIONES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/soluciones/[slug]">): Promise<Metadata> {
  const s = solucionPorSlug((await params).slug);
  if (!s) return {};
  return { title: s.seo.titulo, description: s.seo.descripcion, alternates: { canonical: `/soluciones/${s.slug}` } };
}

export default async function SolucionPage({ params }: PageProps<"/soluciones/[slug]">) {
  const s = solucionPorSlug((await params).slug);
  if (!s) notFound();
  const contacto = `/contacto?origen=${encodeURIComponent(`/soluciones/${s.slug}`)}&sector=${encodeURIComponent(s.sector)}`;

  return (
    <main className="bg-white text-neutral-950">
      <Hero
        etiqueta={s.hero.etiqueta}
        titulo={s.hero.titulo}
        destacado={s.hero.destacado}
        texto={<p>{s.hero.texto}</p>}
        principal={{ href: contacto, texto: "Solicitar una demo" }}
        secundaria={{ href: "#como-funciona", texto: "Ver cómo funciona" }}
      />

      <Seccion etiqueta="El problema" titulo={s.problema.titulo} destacado={s.problema.destacado}>
        <Tarjetas items={s.problema.items} />
      </Seccion>

      <Seccion id="como-funciona" etiqueta="Cómo funciona" titulo={s.pasos.titulo} destacado={s.pasos.destacado}>
        <Pasos items={s.pasos.items} />
      </Seccion>

      {s.dialogo && (
        <section data-tema="oscuro" className="bg-tinta-950 px-6 py-24 text-white lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1fr_1.25fr]">
            <div>
              <p className={cn(etiqueta, "text-marca-400")}>Una llamada de ejemplo</p>
              <h2 className={cn(titular, "mt-5 text-[clamp(2.1rem,4.2vw,3.6rem)] leading-[1.02]")}>{s.dialogo.titulo}</h2>
              <p className="mt-6 max-w-md leading-relaxed text-white/60">{s.dialogo.texto}</p>
              <div className="mt-12 hidden h-32 opacity-80 lg:block" aria-hidden>
                <OndaPuntos color="253, 106, 110" columnas={36} puntosPorColumna={20} />
              </div>
            </div>
            <Dialogo titulo={s.dialogo.conversacion.titulo} turnos={s.dialogo.conversacion.turnos} />
          </div>
        </section>
      )}

      <Seccion etiqueta="Qué ganas" titulo={s.beneficios.titulo} destacado={s.beneficios.destacado}>
        <Tarjetas items={s.beneficios.items} />
      </Seccion>

      <Preguntas items={s.preguntas} />

      <CtaFinal titulo={s.cta.titulo} destacado={s.cta.destacado} origen={`/soluciones/${s.slug}`} />
    </main>
  );
}

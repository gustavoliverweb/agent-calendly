import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowUpRightIcon } from "lucide-react";
import { CtaFinal } from "@/components/landing/bloques";
import { cuerpo, entradilla, rotulo, titularPagina } from "@/components/landing/estilos";
import { type Bloque, recursoPorSlug, RECURSOS } from "@/lib/contenido/recursos";
import { cn } from "@/lib/utils";

/** Guías de /recursos. El contenido está en lib/contenido/recursos.ts. */

export function generateStaticParams() {
  return RECURSOS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/recursos/[slug]">): Promise<Metadata> {
  const r = recursoPorSlug((await params).slug);
  if (!r) return {};
  return {
    title: r.titulo,
    description: r.resumen,
    alternates: { canonical: `/recursos/${r.slug}` },
    openGraph: { type: "article", modifiedTime: r.revisado },
  };
}

const fecha = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function BloqueRecurso({ b }: { b: Bloque }) {
  switch (b.tipo) {
    case "parrafo":
      return <p className={cn(cuerpo, "text-carbon/85")}>{b.texto}</p>;
    case "lista":
      return (
        <ul className="flex flex-col gap-3">
          {b.items.map((i) => (
            <li key={i} className="flex gap-3 text-[17px] leading-relaxed text-carbon/85">
              <span className="mt-[0.7em] size-1 shrink-0 rounded-full bg-marca-600" aria-hidden />
              {i}
            </li>
          ))}
        </ul>
      );
    case "tabla":
      return (
        <div className="overflow-x-auto rounded-xl border border-carbon/15">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-marca-50">
              <tr>
                {b.cabecera.map((c) => (
                  <th key={c} scope="col" className="px-5 py-3 text-[15px] font-semibold text-carbon">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.filas.map(([a, d]) => (
                <tr key={a} className="border-t border-carbon/10 align-top">
                  <th scope="row" className="w-2/5 px-5 py-4 font-medium text-carbon">
                    {a}
                  </th>
                  <td className="px-5 py-4 leading-relaxed text-ceniza">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "ejemplo":
      return (
        <figure className="rounded-xl border-l-4 border-marca-600 bg-marca-50 px-6 py-5">
          <figcaption className="text-[15px] font-semibold text-marca-700">{b.titulo}</figcaption>
          <p className="mt-2 text-[19px] leading-relaxed text-carbon">«{b.texto}»</p>
        </figure>
      );
    case "nota":
      return (
        <p className="border-l-2 border-carbon/20 pl-5 text-[16px] leading-relaxed text-ceniza italic">{b.texto}</p>
      );
  }
}

export default async function RecursoPage({ params }: PageProps<"/recursos/[slug]">) {
  const r = recursoPorSlug((await params).slug);
  if (!r) notFound();
  const otros = RECURSOS.filter((o) => o.slug !== r.slug);

  return (
    <main className="bg-white">
      <article className="-mt-[4.5rem] px-6 pt-36 pb-24 sm:pt-44">
        <div className="mx-auto max-w-3xl">
          <Link href="/recursos" className="inline-flex items-center gap-2 text-[15px] text-ceniza hover:text-carbon">
            <ArrowLeftIcon className="size-4" /> Recursos
          </Link>
          <p className={cn(rotulo, "mt-10")}>{r.categoria}</p>
          <h1 className={cn(titularPagina, "mt-4")}>{r.titulo}</h1>
          <p className={cn(entradilla, "mt-6")}>{r.resumen}</p>
          <p className="mt-6 text-[15px] text-ceniza">
            {r.lectura} min de lectura. Revisado el <time dateTime={r.revisado}>{fecha.format(new Date(`${r.revisado}T00:00:00Z`))}</time>
          </p>

          <div className="mt-14 flex flex-col gap-14">
            {r.secciones.map((s) => (
              <section key={s.titulo} className="flex flex-col gap-5">
                <h2 className="text-[31px] leading-tight font-semibold tracking-[-0.025em] [font-stretch:86%]">{s.titulo}</h2>
                {s.bloques.map((b, i) => (
                  <BloqueRecurso key={i} b={b} />
                ))}
              </section>
            ))}
          </div>
        </div>
      </article>

      {otros.length > 0 && (
        <section className="border-t border-carbon/10 px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-[25px] font-semibold tracking-[-0.02em]">Otras guías</h2>
            <ul className="mt-6 flex flex-col">
              {otros.map((o) => (
                <li key={o.slug} className="border-t border-carbon/10 last:border-b">
                  <Link href={`/recursos/${o.slug}`} className="group flex items-center justify-between gap-6 py-5">
                    <span>
                      <span className="block text-xl font-semibold tracking-[-0.015em]">{o.titulo}</span>
                      <span className="mt-1 block text-[16px] text-ceniza">{o.resumen}</span>
                    </span>
                    <ArrowUpRightIcon className="size-5 shrink-0 text-ceniza transition-colors group-hover:text-marca-600" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaFinal titulo="¿Te ayudamos a prepararlo?" destacado="Lo vemos contigo." origen={`/recursos/${r.slug}`} />
    </main>
  );
}

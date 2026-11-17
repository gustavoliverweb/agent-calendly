import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowUpRightIcon } from "lucide-react";
import { CtaFinal } from "@/components/landing/bloques";
import { etiqueta, titular } from "@/components/landing/estilos";
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
      return <p className="leading-relaxed text-neutral-700">{b.texto}</p>;
    case "lista":
      return (
        <ul className="flex flex-col gap-3">
          {b.items.map((i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-neutral-700">
              <span className="mt-3 h-px w-3 shrink-0 bg-marca-400" aria-hidden />
              {i}
            </li>
          ))}
        </ul>
      );
    case "tabla":
      return (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-neutral-50">
              <tr>
                {b.cabecera.map((c) => (
                  <th key={c} scope="col" className={cn(etiqueta, "px-5 py-3.5 font-normal text-neutral-500")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.filas.map(([a, d]) => (
                <tr key={a} className="border-t border-neutral-200 align-top">
                  <th scope="row" className="w-2/5 px-5 py-4 font-normal text-neutral-950">
                    {a}
                  </th>
                  <td className="px-5 py-4 leading-relaxed text-neutral-600">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "ejemplo":
      return (
        <figure className="rounded-2xl bg-tinta-950 p-6 text-white">
          <figcaption className={cn(etiqueta, "text-marca-400")}>{b.titulo}</figcaption>
          <p className="mt-4 font-mono text-[14px] leading-relaxed text-white/85">{b.texto}</p>
        </figure>
      );
    case "nota":
      return (
        <p className="rounded-2xl border-l-2 border-marca-500 bg-marca-50 px-5 py-4 leading-relaxed text-marca-950">{b.texto}</p>
      );
  }
}

export default async function RecursoPage({ params }: PageProps<"/recursos/[slug]">) {
  const r = recursoPorSlug((await params).slug);
  if (!r) notFound();
  const otros = RECURSOS.filter((o) => o.slug !== r.slug);

  return (
    <main className="bg-white text-neutral-950">
      <article className="-mt-[4.5rem] px-6 pt-36 pb-24 sm:pt-44">
        <div className="mx-auto max-w-3xl">
          <Link href="/recursos" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-950">
            <ArrowLeftIcon className="size-4" /> Recursos
          </Link>
          <p className={cn(etiqueta, "mt-10 text-marca-600")}>{r.categoria}</p>
          <h1 className={cn(titular, "mt-5 text-[clamp(2.4rem,5vw,4rem)] leading-[1.02]")}>{r.titulo}</h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-600">{r.resumen}</p>
          <p className="mt-6 font-mono text-xs text-neutral-400">
            {r.lectura} min de lectura · Revisado el <time dateTime={r.revisado}>{fecha.format(new Date(`${r.revisado}T00:00:00Z`))}</time>
          </p>

          <div className="mt-14 flex flex-col gap-14">
            {r.secciones.map((s) => (
              <section key={s.titulo} className="flex flex-col gap-5">
                <h2 className="text-2xl tracking-[-0.03em] sm:text-3xl">{s.titulo}</h2>
                {s.bloques.map((b, i) => (
                  <BloqueRecurso key={i} b={b} />
                ))}
              </section>
            ))}
          </div>
        </div>
      </article>

      {otros.length > 0 && (
        <section className="border-t border-neutral-100 px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <p className={cn(etiqueta, "text-marca-600")}>Otras guías</p>
            <ul className="mt-6 flex flex-col">
              {otros.map((o) => (
                <li key={o.slug} className="border-t border-neutral-200 last:border-b">
                  <Link href={`/recursos/${o.slug}`} className="group flex items-center justify-between gap-6 py-5">
                    <span>
                      <span className="block text-lg tracking-[-0.01em]">{o.titulo}</span>
                      <span className="mt-1 block text-[15px] text-neutral-500">{o.resumen}</span>
                    </span>
                    <ArrowUpRightIcon className="size-5 shrink-0 text-neutral-400 transition-colors group-hover:text-marca-600" />
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

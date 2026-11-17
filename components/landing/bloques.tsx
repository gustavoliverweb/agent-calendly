import type { ReactNode } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { OndaPuntos } from "@/components/landing/onda-puntos";
import {
  botonBorde,
  botonBordeOscuro,
  botonClaro,
  botonPrincipal,
  cuerpo,
  entradilla,
  rotulo,
  titularPagina,
  titularSeccion,
} from "@/components/landing/estilos";
import { cn } from "@/lib/utils";

/**
 * Bloques de las páginas de contenido de la web (precios, seguridad,
 * soluciones…). Todo alineado a la izquierda; el único elemento animado es la
 * onda de voz de la cabecera de cada página.
 */

export type Accion = { href: string; texto: string };

export function Hero({
  etiqueta,
  titulo,
  destacado,
  texto,
  principal,
  secundaria,
  onda = true,
}: {
  /** Para quién es la página. Se omite si solo repetiría el nombre de la página. */
  etiqueta?: string;
  titulo: string;
  /** Segunda frase del titular: va en el mismo h1, sin resaltar. */
  destacado?: string;
  texto: ReactNode;
  principal?: Accion;
  secundaria?: Accion;
  onda?: boolean;
}) {
  return (
    <section className="relative -mt-[4.5rem] overflow-hidden px-6 pt-36 pb-14 sm:pt-44 lg:pb-20">
      <div className="relative mx-auto max-w-7xl">
        {etiqueta && <p className={cn(rotulo, "mb-5")}>{etiqueta}</p>}
        <h1 className={cn(titularPagina, "max-w-5xl")}>{destacado ? `${titulo} ${destacado}` : titulo}</h1>
        <div className={cn(entradilla, "mt-8 max-w-2xl")}>{texto}</div>
        {(principal || secundaria) && (
          <div className="mt-10 flex flex-wrap gap-3">
            {principal && (
              <Link href={principal.href} className={botonPrincipal}>
                {principal.texto}
              </Link>
            )}
            {secundaria && (
              <Link href={secundaria.href} className={botonBorde}>
                {secundaria.texto}
              </Link>
            )}
          </div>
        )}
      </div>
      {onda && (
        <div className="pointer-events-none mx-auto mt-16 h-28 max-w-7xl lg:mt-20" aria-hidden>
          <OndaPuntos color="225, 29, 46" columnas={80} puntosPorColumna={18} />
        </div>
      )}
    </section>
  );
}

/**
 * Sección con el titular a la izquierda y el contenido a la derecha. Con
 * `apilada`, el contenido va debajo a todo el ancho (rejillas, tablas…).
 */
export function Seccion({
  id,
  oscuro,
  apilada,
  titulo,
  destacado,
  texto,
  children,
}: {
  id?: string;
  oscuro?: boolean;
  apilada?: boolean;
  titulo: string;
  destacado?: string;
  texto?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-tema={oscuro ? "oscuro" : undefined}
      className={cn("scroll-mt-24 px-6 py-20 lg:py-28", oscuro ? "bg-tinta-950 text-white" : "border-t border-carbon/10")}
    >
      <div className={cn("mx-auto max-w-7xl", !apilada && "grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16")}>
        <div className={cn(apilada ? "max-w-3xl" : "lg:sticky lg:top-28 lg:self-start")}>
          <h2 className={titularSeccion}>{titulo}</h2>
          {destacado && <p className={cn(entradilla, "mt-4", oscuro && "text-white/65")}>{destacado}</p>}
          {texto && <div className={cn(cuerpo, "mt-5", oscuro && "text-white/65")}>{texto}</div>}
        </div>
        <div className={cn(apilada && "mt-12")}>{children}</div>
      </div>
    </section>
  );
}

/** Puntos clave sin orden: título + explicación, en una o dos columnas. */
export function Lista({ items, oscuro, columnas = 2 }: { items: [string, string][]; oscuro?: boolean; columnas?: 1 | 2 | 3 }) {
  return (
    <ul
      className={cn(
        "grid gap-x-12 gap-y-10",
        columnas === 2 && "sm:grid-cols-2",
        columnas === 3 && "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {items.map(([t, d]) => (
        <li key={t}>
          <h3 className="text-xl font-semibold tracking-[-0.015em]">{t}</h3>
          <p className={cn("mt-2 max-w-[62ch] text-[17px] leading-relaxed", oscuro ? "text-white/65" : "text-ceniza")}>{d}</p>
        </li>
      ))}
    </ul>
  );
}

/** Pasos de un proceso: aquí sí hay orden, así que van numerados. */
export function Pasos({ items }: { items: { clave: string; titulo: string; texto: string }[] }) {
  return (
    <ol className="flex flex-col gap-10">
      {items.map((p, i) => (
        <li key={p.clave} className="grid grid-cols-[2.75rem_1fr] gap-4 sm:grid-cols-[3.5rem_1fr]">
          <span className="text-[31px] leading-none font-semibold text-marca-600 tabular-nums [font-stretch:86%]">{i + 1}</span>
          <div>
            <h3 className="text-[25px] leading-tight font-semibold tracking-[-0.02em]">{p.titulo}</h3>
            <p className={cn(cuerpo, "mt-2 max-w-xl")}>{p.texto}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Conversación de ejemplo (estática): agente a la izquierda, contacto a la derecha. */
export function Dialogo({ titulo, turnos }: { titulo: string; turnos: { quien: "agente" | "contacto" | "nota"; texto: string }[] }) {
  return (
    <figure className="rounded-[1.75rem] bg-white/[0.06] p-5 sm:p-7">
      <figcaption className="flex items-center gap-2 text-[15px] text-white/60">
        <span className="size-2 rounded-full bg-marca-400" aria-hidden /> {titulo}
      </figcaption>
      <ul className="mt-6 flex flex-col gap-3">
        {turnos.map((t, i) =>
          t.quien === "nota" ? (
            <li key={i} className="px-1 text-sm text-white/50 italic">
              {t.texto}
            </li>
          ) : (
            <li
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-[16px] leading-relaxed",
                t.quien === "agente" ? "self-start rounded-bl-sm bg-white text-carbon" : "self-end rounded-br-sm bg-white/12 text-white",
              )}
            >
              <span className="sr-only">{t.quien === "agente" ? "Agente: " : "Contacto: "}</span>
              {t.texto}
            </li>
          ),
        )}
      </ul>
    </figure>
  );
}

export function Preguntas({ items, titulo = "Preguntas frecuentes" }: { items: [string, string][]; titulo?: string }) {
  return (
    <Seccion titulo={titulo}>
      <div className="border-b border-carbon/10">
        {items.map(([p, r]) => (
          <details key={p} className="group border-t border-carbon/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium [&::-webkit-details-marker]:hidden">
              {p}
              <PlusIcon className="size-5 shrink-0 text-ceniza transition-transform duration-200 group-open:rotate-45" />
            </summary>
            <p className={cn(cuerpo, "max-w-2xl pb-6")}>{r}</p>
          </details>
        ))}
      </div>
    </Seccion>
  );
}

/** Cierre de página con la llamada a la acción. `origen` llega al formulario de contacto. */
export function CtaFinal({
  titulo,
  destacado,
  origen,
  secundaria = { href: "/precios", texto: "Ver precios" },
}: {
  titulo: string;
  destacado: string;
  origen: string;
  secundaria?: Accion;
}) {
  return (
    <section data-tema="oscuro" className="bg-tinta-950 px-6 py-24 text-white lg:py-32">
      <div className="mx-auto max-w-7xl">
        <h2 className={cn(titularPagina, "max-w-4xl")}>{titulo}</h2>
        <p className={cn(entradilla, "mt-5 max-w-2xl text-white/65")}>{destacado}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={`/contacto?origen=${encodeURIComponent(origen)}`} className={botonClaro}>
            Solicitar una demo
          </Link>
          <Link href={secundaria.href} className={botonBordeOscuro}>
            {secundaria.texto}
          </Link>
        </div>
      </div>
    </section>
  );
}

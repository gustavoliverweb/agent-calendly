import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import { OndaPuntos } from "@/components/landing/onda-puntos";
import { botonBorde, botonBordeOscuro, botonPrincipal, etiqueta, titular } from "@/components/landing/estilos";
import { cn } from "@/lib/utils";

/**
 * Bloques de las páginas de contenido de la web (precios, seguridad,
 * soluciones…). Mismo lenguaje visual que la página de inicio.
 */

export type Accion = { href: string; texto: string };

export function Hero({
  etiqueta: eti,
  titulo,
  destacado,
  texto,
  principal,
  secundaria,
  onda = true,
}: {
  etiqueta: string;
  titulo: string;
  destacado?: string;
  texto: ReactNode;
  principal?: Accion;
  secundaria?: Accion;
  onda?: boolean;
}) {
  return (
    <section className="relative -mt-[4.5rem] overflow-hidden px-6 pt-36 pb-12 sm:pt-44 lg:pb-16">
      <div className="relative mx-auto max-w-7xl">
        <p className={cn(etiqueta, "text-marca-600")}>{eti}</p>
        <h1 className={cn(titular, "mt-6 max-w-5xl text-[clamp(2.5rem,5.6vw,5rem)] leading-[0.98]")}>
          {titulo}{" "}
          {destacado && (
            <span className="bg-linear-to-r from-marca-700 to-marca-500 bg-clip-text text-transparent">{destacado}</span>
          )}
        </h1>
        <div className="mt-7 max-w-2xl text-lg leading-relaxed text-neutral-600">{texto}</div>
        {(principal || secundaria) && (
          <div className="mt-9 flex flex-wrap gap-3">
            {principal && (
              <Link href={principal.href} className={botonPrincipal}>
                {principal.texto} <ArrowRightIcon className="size-4" />
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
        <div className="pointer-events-none mx-auto mt-14 h-24 max-w-7xl opacity-60 lg:mt-20" aria-hidden>
          <OndaPuntos color="225, 29, 46" columnas={80} puntosPorColumna={16} />
        </div>
      )}
    </section>
  );
}

export function Seccion({
  id,
  oscuro,
  etiqueta: eti,
  titulo,
  destacado,
  texto,
  children,
}: {
  id?: string;
  oscuro?: boolean;
  etiqueta: string;
  titulo: string;
  destacado?: string;
  texto?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-tema={oscuro ? "oscuro" : undefined}
      className={cn("scroll-mt-24 px-6 py-24 lg:py-32", oscuro ? "bg-tinta-950 text-white" : "border-t border-neutral-100")}
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className={cn(etiqueta, oscuro ? "text-marca-400" : "text-marca-600")}>{eti}</p>
          <h2 className={cn(titular, "mt-5 text-[clamp(2.1rem,4.2vw,3.6rem)] leading-[1.02]")}>
            {titulo} {destacado && <span className={oscuro ? "text-white/45" : "text-neutral-400"}>{destacado}</span>}
          </h2>
          {texto && <div className={cn("mt-6 leading-relaxed", oscuro ? "text-white/60" : "text-neutral-600")}>{texto}</div>}
        </div>
        <div className="mt-14">{children}</div>
      </div>
    </section>
  );
}

/** Rejilla de puntos clave: título + texto. */
export function Tarjetas({ items, oscuro, columnas = 3 }: { items: [string, string][]; oscuro?: boolean; columnas?: 2 | 3 }) {
  return (
    <ul
      className={cn(
        "grid gap-px overflow-hidden rounded-3xl border",
        oscuro ? "border-white/10 bg-white/10" : "border-neutral-200 bg-neutral-200",
        columnas === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {items.map(([t, d], i) => (
        <li key={t} className={cn("p-7 sm:p-8", oscuro ? "bg-tinta-950" : "bg-white")}>
          <p className={cn(etiqueta, oscuro ? "text-marca-400" : "text-marca-600")}>{String(i + 1).padStart(2, "0")}</p>
          <h3 className="mt-6 text-xl tracking-[-0.02em]">{t}</h3>
          <p className={cn("mt-3 leading-relaxed", oscuro ? "text-white/55" : "text-neutral-600")}>{d}</p>
        </li>
      ))}
    </ul>
  );
}

/** Pasos numerados, como «Cómo funciona» de la página de inicio. */
export function Pasos({ items }: { items: { clave: string; titulo: string; texto: string }[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((p, i) => (
        <li key={p.clave} className="grid grid-cols-[4.5rem_1fr] gap-4 border-t border-neutral-200 py-9 sm:grid-cols-[7rem_1fr]">
          <span className="text-5xl tracking-[-0.05em] text-marca-200 tabular-nums sm:text-6xl">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <p className={cn(etiqueta, "flex items-center gap-3 text-marca-600")}>
              <span className="h-px w-8 bg-marca-300" /> {p.clave}
            </p>
            <h3 className="mt-3 text-2xl tracking-[-0.03em] sm:text-3xl">{p.titulo}</h3>
            <p className="mt-3 max-w-xl leading-relaxed text-neutral-600">{p.texto}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Conversación de ejemplo (estática): agente a la izquierda, contacto a la derecha. */
export function Dialogo({ titulo, turnos }: { titulo: string; turnos: { quien: "agente" | "contacto" | "nota"; texto: string }[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
      <p className={cn(etiqueta, "flex items-center gap-2 text-white/50")}>
        <span className="size-1.5 rounded-full bg-marca-500" aria-hidden /> {titulo}
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {turnos.map((t, i) =>
          t.quien === "nota" ? (
            <li key={i} className="font-mono text-xs text-white/40">
              → {t.texto}
            </li>
          ) : (
            <li
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
                t.quien === "agente" ? "self-start rounded-bl-md bg-white text-neutral-950" : "self-end rounded-br-md bg-white/10 text-white",
              )}
            >
              {t.texto}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

export function Preguntas({ items, titulo = "Lo que quieres saber." }: { items: [string, string][]; titulo?: string }) {
  return (
    <section className="border-t border-neutral-100 px-6 py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className={cn(etiqueta, "text-marca-600")}>Preguntas</p>
          <h2 className={cn(titular, "mt-5 text-[clamp(2.1rem,4.2vw,3.6rem)] leading-[1.02]")}>{titulo}</h2>
        </div>
        <div className="border-b border-neutral-200">
          {items.map(([p, r]) => (
            <details key={p} className="group border-t border-neutral-200">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                {p}
                <PlusIcon className="size-5 shrink-0 text-neutral-400 transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <p className="max-w-2xl pb-7 leading-relaxed text-neutral-600">{r}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
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
    <section data-tema="oscuro" className="relative overflow-hidden bg-tinta-950 px-6 pt-28 pb-24 text-white lg:pt-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-60" aria-hidden>
        <OndaPuntos color="253, 106, 110" columnas={72} puntosPorColumna={20} />
      </div>
      <div className="relative mx-auto max-w-4xl text-center">
        <h2 className={cn(titular, "text-[clamp(2.4rem,5.6vw,4.75rem)] leading-[0.98]")}>
          {titulo} <span className="text-white/45">{destacado}</span>
        </h2>
        <div className="mt-11 flex flex-wrap justify-center gap-3">
          <Link href={`/contacto?origen=${encodeURIComponent(origen)}`} className={botonPrincipal}>
            Solicitar una demo <ArrowRightIcon className="size-4" />
          </Link>
          <Link href={secundaria.href} className={botonBordeOscuro}>
            {secundaria.texto}
          </Link>
        </div>
      </div>
    </section>
  );
}

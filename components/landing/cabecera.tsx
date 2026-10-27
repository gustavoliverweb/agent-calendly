"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { Logo } from "@/components/marca/logo";
import { enlaceDemo } from "@/lib/marca";
import { cn } from "@/lib/utils";

const SECCIONES = [
  { href: "/#como-funciona", texto: "Cómo funciona" },
  { href: "/#llamada", texto: "Una llamada" },
  { href: "/#panel", texto: "El panel" },
  { href: "/#seguridad", texto: "RGPD" },
  { href: "/#preguntas", texto: "Preguntas" },
];

/**
 * Cabecera flotante en píldora translúcida. Sobre una sección marcada con
 * data-tema="oscuro" pasa a cristal oscuro para no perder contraste.
 */
export function Cabecera() {
  const ref = useRef<HTMLElement>(null);
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    let frame = 0;
    const comprobar = () => {
      frame = 0;
      const cabecera = ref.current;
      if (!cabecera) return;
      const { top, height } = cabecera.getBoundingClientRect();
      const debajo = document
        .elementsFromPoint(window.innerWidth / 2, top + height / 2)
        .find((el) => !cabecera.contains(el));
      setOscuro(Boolean(debajo?.closest('[data-tema="oscuro"]')));
    };
    const programar = () => {
      if (!frame) frame = requestAnimationFrame(comprobar);
    };
    programar();
    window.addEventListener("scroll", programar, { passive: true });
    window.addEventListener("resize", programar);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", programar);
      window.removeEventListener("resize", programar);
    };
  }, []);

  return (
    <header ref={ref} className="sticky top-3 z-40 px-3 sm:top-4 sm:px-6">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 rounded-full border pr-2 pl-5 backdrop-blur-xl transition-colors duration-300",
          oscuro
            ? "border-white/10 bg-neutral-900/70 text-white"
            : "border-black/5 bg-white/75 text-neutral-950 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]",
        )}
      >
        <Link href="/" aria-label="Inicio">
          <Logo />
        </Link>
        <nav
          aria-label="Secciones"
          className={cn("hidden items-center gap-7 text-sm lg:flex", oscuro ? "text-white/65" : "text-neutral-600")}
        >
          {SECCIONES.map((s) => (
            <Link key={s.href} href={s.href} className={cn("transition-colors", oscuro ? "hover:text-white" : "hover:text-neutral-950")}>
              {s.texto}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className={cn(
              "inline-flex h-10 items-center rounded-full px-3 text-sm transition-colors sm:px-4",
              oscuro ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-neutral-700 hover:bg-black/5 hover:text-neutral-950",
            )}
          >
            Acceder
          </Link>
          <a
            href={enlaceDemo}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm transition-colors",
              oscuro ? "bg-white text-neutral-950 hover:bg-neutral-200" : "bg-neutral-950 text-white hover:bg-neutral-800",
            )}
          >
            Hablemos <ArrowUpRightIcon className="size-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}

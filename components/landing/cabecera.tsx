"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, MenuIcon, XIcon } from "lucide-react";
import { Logo } from "@/components/marca/logo";
import { SOLUCIONES } from "@/lib/contenido/soluciones";
import { enlaceDemo } from "@/lib/marca";
import { cn } from "@/lib/utils";

// El primero va antes del menú de soluciones. «Contacto» lo cubre el botón «Hablemos».
const SECCIONES = [
  { href: "/producto", texto: "Producto" },
  { href: "/precios", texto: "Precios" },
  { href: "/recursos", texto: "Recursos" },
  { href: "/seguridad", texto: "Seguridad" },
];

/**
 * Cabecera flotante en píldora translúcida. Sobre una sección marcada con
 * data-tema="oscuro" pasa a cristal oscuro para no perder contraste.
 */
export function Cabecera({ nombre, logoUrl }: { nombre: string; logoUrl: string | null }) {
  const ref = useRef<HTMLElement>(null);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const idMenu = useId();
  const [oscuro, setOscuro] = useState(false);
  const [abierto, setAbierto] = useState(false);

  // Menú móvil: Escape lo cierra y devuelve el foco al botón; un clic fuera, también.
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        botonMenu.current?.focus();
      }
    };
    const fuera = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fuera);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fuera);
    };
  }, [abierto]);

  const cerrar = () => setAbierto(false);

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
            ? "border-white/10 bg-tinta-900/70 text-white"
            : "border-black/5 bg-white/75 text-carbon shadow-[0_6px_24px_-14px_rgba(51,9,15,0.35)]",
        )}
      >
        <Link href="/" aria-label="Inicio">
          <Logo nombre={nombre} logoUrl={logoUrl} />
        </Link>
        <nav
          aria-label="Secciones"
          className={cn("hidden items-center gap-7 text-[15px] lg:flex", oscuro ? "text-white/75" : "text-ceniza")}
        >
          <Link href={SECCIONES[0].href} className={cn("transition-colors", oscuro ? "hover:text-white" : "hover:text-carbon")}>
            {SECCIONES[0].texto}
          </Link>
          {/* Menú de soluciones: se abre al pasar el ratón o con el teclado (focus-within). */}
          <div className="group relative">
            <button
              type="button"
              aria-haspopup="true"
              className={cn("inline-flex items-center gap-1 transition-colors", oscuro ? "hover:text-white" : "hover:text-carbon")}
            >
              Soluciones <ChevronDownIcon className="size-3.5 transition-transform group-focus-within:rotate-180 group-hover:rotate-180" />
            </button>
            <div className="invisible absolute top-full left-1/2 z-50 w-64 -translate-x-1/2 pt-4 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <ul className="rounded-2xl border border-black/5 bg-white p-2 text-carbon shadow-[0_20px_50px_-20px_rgba(51,9,15,0.4)]">
                {SOLUCIONES.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/soluciones/${s.slug}`} className="block rounded-xl px-3 py-2.5 hover:bg-marca-50 hover:text-marca-800">
                      {s.menu}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {SECCIONES.slice(1).map((s) => (
            <Link key={s.href} href={s.href} className={cn("transition-colors", oscuro ? "hover:text-white" : "hover:text-carbon")}>
              {s.texto}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className={cn(
              "hidden h-10 items-center rounded-full px-4 text-[15px] transition-colors sm:inline-flex",
              oscuro ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-carbon/80 hover:bg-black/5 hover:text-carbon",
            )}
          >
            Acceder
          </Link>
          <Link
            href={enlaceDemo}
            className={cn(
              "inline-flex h-10 items-center rounded-full px-4 text-[15px] font-medium whitespace-nowrap transition-colors",
              // Sobre granate, el rojo no contrasta: la acción pasa a blanco.
              oscuro ? "bg-white text-tinta-950 hover:bg-marca-50" : "bg-marca-600 text-white hover:bg-marca-700",
            )}
          >
            Solicitar demo
          </Link>
          <button
            ref={botonMenu}
            type="button"
            aria-expanded={abierto}
            aria-controls={idMenu}
            onClick={() => setAbierto((a) => !a)}
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-full transition-colors lg:hidden",
              oscuro ? "text-white hover:bg-white/10" : "text-carbon hover:bg-black/5",
            )}
          >
            {abierto ? <XIcon className="size-5" aria-hidden /> : <MenuIcon className="size-5" aria-hidden />}
            <span className="sr-only">{abierto ? "Cerrar menú" : "Abrir menú"}</span>
          </button>
        </div>
      </div>

      {abierto && (
        <nav
          id={idMenu}
          aria-label="Menú"
          className="animate-in fade-in slide-in-from-top-1 absolute inset-x-3 top-full mt-2 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[1.75rem] border border-black/5 bg-white p-3 text-carbon shadow-[0_24px_60px_-24px_rgba(51,9,15,0.45)] duration-150 sm:inset-x-6 lg:hidden"
        >
          <ul className="flex flex-col">
            {SECCIONES.map((s) => (
              <li key={s.href}>
                <Link href={s.href} onClick={cerrar} className="block rounded-2xl px-4 py-3 text-[19px] font-medium hover:bg-marca-50">
                  {s.texto}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 px-4 text-[15px] text-ceniza">Soluciones</p>
          <ul className="mt-1 grid sm:grid-cols-2">
            {SOLUCIONES.map((s) => (
              <li key={s.slug}>
                <Link href={`/soluciones/${s.slug}`} onClick={cerrar} className="block rounded-2xl px-4 py-2.5 text-[17px] hover:bg-marca-50">
                  {s.menu}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-carbon/10 px-1 pt-3">
            <Link href="/login" onClick={cerrar} className="block rounded-2xl px-3 py-3 text-[17px] hover:bg-marca-50">
              Acceder al panel
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

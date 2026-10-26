import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { enlaceDemo, MARCA } from "@/lib/marca";

export function Pie() {
  return (
    <footer data-tema="oscuro" className="bg-neutral-950 px-6 pt-20 pb-10 text-white">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">{MARCA.descripcion}</p>
        </div>
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-white/40 uppercase">Producto</p>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-white/70">
            <li><a href="#como-funciona" className="hover:text-white">Cómo funciona</a></li>
            <li><a href="#panel" className="hover:text-white">El panel</a></li>
            <li><a href="#seguridad" className="hover:text-white">Seguridad y RGPD</a></li>
            <li><a href="#preguntas" className="hover:text-white">Preguntas</a></li>
          </ul>
        </div>
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-white/40 uppercase">Cuenta</p>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-white/70">
            <li><Link href="/login" className="hover:text-white">Acceder al panel</Link></li>
            <li><a href={enlaceDemo} className="hover:text-white">Solicitar una demo</a></li>
            <li><a href={`mailto:${MARCA.email}`} className="hover:text-white">{MARCA.email}</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-16 flex max-w-7xl flex-wrap justify-between gap-4 border-t border-white/10 pt-6 font-mono text-[11px] tracking-[0.14em] text-white/35 uppercase">
        <span>© {MARCA.nombre}</span>
        <span>Datos alojados en la UE</span>
      </div>
    </footer>
  );
}

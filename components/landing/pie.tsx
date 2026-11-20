import Link from "next/link";
import { DOCUMENTOS_LEGALES } from "@/components/legal/documento-legal";
import { Logo } from "@/components/marca/logo";
import { marcaPlataforma } from "@/lib/marca-plataforma";
import { RECURSOS } from "@/lib/contenido/recursos";
import { SOLUCIONES } from "@/lib/contenido/soluciones";
import { enlaceDemo } from "@/lib/marca";

export async function Pie() {
  const marca = await marcaPlataforma();
  return (
    <footer data-tema="oscuro" className="border-t border-white/15 bg-tinta-950 px-6 pt-20 pb-10 text-white">
      <div className="mx-auto grid max-w-7xl gap-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div>
          <Logo nombre={marca.nombre} logoUrl={marca.logoUrl} />
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">{marca.descripcion}</p>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-white">Producto</p>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-white/75">
            <li><Link href="/producto" className="hover:text-white">Qué hace</Link></li>
            <li><Link href="/integraciones" className="hover:text-white">Integraciones</Link></li>
            <li><Link href="/precios" className="hover:text-white">Precios</Link></li>
            <li><Link href="/calculadora" className="hover:text-white">Calculadora de retorno</Link></li>
            <li><Link href="/seguridad" className="hover:text-white">Seguridad y RGPD</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-white">Soluciones</p>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-white/75">
            {SOLUCIONES.map((s) => (
              <li key={s.slug}>
                <Link href={`/soluciones/${s.slug}`} className="hover:text-white">
                  {s.menu}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-white">Recursos</p>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-white/75">
            {RECURSOS.map((r) => (
              <li key={r.slug}>
                <Link href={`/recursos/${r.slug}`} className="hover:text-white">
                  {r.titulo}
                </Link>
              </li>
            ))}
            <li><Link href="/recursos" className="hover:text-white">Todas las guías</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-white">Cuenta</p>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-white/75">
            <li><Link href="/login" className="hover:text-white">Acceder al panel</Link></li>
            <li><Link href={enlaceDemo} className="hover:text-white">Solicitar una demo</Link></li>
            <li><a href={`mailto:${marca.email}`} className="hover:text-white">{marca.email}</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-16 flex max-w-7xl flex-wrap justify-between gap-4 border-t border-white/10 pt-6 text-[14px] text-white/55">
        <span>© {marca.nombre}</span>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
          {DOCUMENTOS_LEGALES.map((d) => (
            <Link key={d.href} href={d.href} className="hover:text-white">
              {d.texto}
            </Link>
          ))}
        </nav>
        <span>Datos alojados en la UE</span>
      </div>
    </footer>
  );
}

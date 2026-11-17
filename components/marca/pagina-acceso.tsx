import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { LogoMarca } from "@/components/marca/logo-marca";
import { contextoDominio, MARCA_PLATAFORMA, type ContextoDominio } from "@/lib/dominio/contexto";
import { estiloMarca } from "@/lib/dominio/estilo";

/**
 * Páginas fuera del panel (login, contraseña, sin empresa) con la marca del
 * dominio: la de la empresa en su dominio, la de la plataforma en el suyo.
 * Lee la petición: renderizar dentro de un <Suspense>.
 */
export async function PaginaAcceso({
  etiqueta,
  titulo,
  subtitulo,
  volver,
  children,
}: {
  etiqueta: string;
  titulo: string;
  subtitulo?: ReactNode;
  volver: "web" | "panel";
  children: (ctx: Exclude<ContextoDominio, { tipo: "desconocido" }>) => ReactNode;
}) {
  const ctx = await contextoDominio();
  if (ctx.tipo === "desconocido") notFound();
  const marca = ctx.tipo === "empresa" ? ctx.empresa.marca : MARCA_PLATAFORMA;
  // En el dominio de una empresa no hay web pública: "/" lleva al panel.
  const destino = volver === "panel" ? { href: "/app", texto: "Volver al panel" } : ctx.tipo === "plataforma" ? { href: "/", texto: "Volver a la web" } : null;

  return (
    <main className="flex flex-1 flex-col bg-white px-4 py-6 text-neutral-950" style={estiloMarca(marca.color)}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        {destino ? (
          <Link href={destino.href} aria-label={destino.texto}>
            <LogoMarca marca={marca} />
          </Link>
        ) : (
          <LogoMarca marca={marca} />
        )}
        {destino && (
          <Link href={destino.href} className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950">
            <ArrowLeftIcon className="size-4" /> {destino.texto}
          </Link>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[11px] tracking-[0.2em] text-neutral-500 uppercase">{etiqueta}</p>
          <h1 className="mt-3 text-4xl font-normal tracking-[-0.04em]">{titulo}</h1>
          {subtitulo && <p className="mt-2 text-sm text-neutral-500">{subtitulo}</p>}
          <div className="mt-8">{children(ctx)}</div>
        </div>
      </div>
      {ctx.tipo === "empresa" && (
        <nav aria-label="Legal" className="mx-auto flex gap-4 text-xs text-neutral-500">
          <Link href="/aviso-legal" className="hover:text-neutral-950">
            Aviso legal
          </Link>
          <Link href="/privacidad" className="hover:text-neutral-950">
            Privacidad
          </Link>
          <Link href="/cookies" className="hover:text-neutral-950">
            Cookies
          </Link>
        </nav>
      )}
    </main>
  );
}

/** Título con el nombre de la marca del dominio, su favicon y sin indexar. */
export async function metadataAcceso(titulo: string): Promise<Metadata> {
  const ctx = await contextoDominio();
  const marca = ctx.tipo === "empresa" ? ctx.empresa.marca : MARCA_PLATAFORMA;
  return {
    title: { absolute: `${titulo} · ${marca.nombre}` },
    robots: { index: false, follow: false },
    ...(marca.faviconUrl ? { icons: { icon: marca.faviconUrl } } : {}),
  };
}

import type { Metadata } from "next";
import { Logo } from "@/components/marca/logo";
import { MARCA } from "@/lib/marca";

export const metadata: Metadata = { title: "Sin empresa", robots: { index: false, follow: false } };

/** Usuario con sesión que no pertenece a ninguna empresa (p. ej. le quitaron el acceso). */
export default function SinEmpresaPage() {
  return (
    <main className="flex flex-1 flex-col bg-white px-4 py-6 text-neutral-950">
      <div className="mx-auto w-full max-w-6xl">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[11px] tracking-[0.2em] text-neutral-500 uppercase">Cuenta</p>
          <h1 className="mt-3 text-4xl font-normal tracking-[-0.04em]">Tu usuario no tiene acceso a ninguna empresa.</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Pide a quien gestiona tu empresa que te invite de nuevo, o escríbenos a {MARCA.email}.
          </p>
          <form action="/auth/salir" method="post" className="mt-8">
            <button type="submit" className="text-sm underline underline-offset-4 hover:text-neutral-600">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

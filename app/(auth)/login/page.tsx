import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Logo } from "@/components/marca/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col bg-white px-4 py-6 text-neutral-950">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/" aria-label="Volver a la web">
          <Logo />
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950">
          <ArrowLeftIcon className="size-4" /> Volver a la web
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[11px] tracking-[0.2em] text-neutral-500 uppercase">Panel</p>
          <h1 className="mt-3 text-4xl font-normal tracking-[-0.04em]">Entra en tu panel.</h1>
          <p className="mt-2 text-sm text-neutral-500">Acceso solo para usuarios invitados.</p>
          <div className="mt-8">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}

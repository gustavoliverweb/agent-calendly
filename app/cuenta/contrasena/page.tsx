import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Logo } from "@/components/marca/logo";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Contraseña", robots: { index: false, follow: false } };

export default function ContrasenaPage() {
  return (
    <main className="flex flex-1 flex-col bg-white px-4 py-6 text-neutral-950">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/app" aria-label="Volver al panel">
          <Logo />
        </Link>
        <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950">
          <ArrowLeftIcon className="size-4" /> Volver al panel
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[11px] tracking-[0.2em] text-neutral-500 uppercase">Cuenta</p>
          <h1 className="mt-3 text-4xl font-normal tracking-[-0.04em]">Elige tu contraseña.</h1>
          <p className="mt-2 text-sm text-neutral-500">Mínimo 10 caracteres.</p>
          <div className="mt-8">
            <PasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}

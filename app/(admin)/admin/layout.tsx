import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { UserMenu } from "@/components/panel/user-menu";

export const metadata: Metadata = {
  title: { template: "%s · Administración", default: "Administración" },
  robots: { index: false, follow: false },
};

/** Área del proveedor del SaaS. Cada página comprueba que el usuario es administrador. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" aria-label="Administración">
            <Logo />
          </Link>
          <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Administración</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app" className="text-sm text-muted-foreground hover:text-foreground">
            Ir al panel
          </Link>
          <Suspense fallback={<div className="h-7 w-40 animate-pulse rounded bg-muted" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}

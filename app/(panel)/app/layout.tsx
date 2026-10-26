import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { NavLinks, PanelNav } from "@/components/panel/nav";
import { PausaGlobal } from "@/components/panel/pausa-global";
import { UserMenu } from "@/components/panel/user-menu";
import { createClient } from "@/lib/supabase/server";

/** El panel es privado: fuera de los buscadores. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PanelLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4">
        <Link href="/app" aria-label="Resumen del panel">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <EstadoPausa />
          </Suspense>
          <Suspense fallback={<div className="h-7 w-40 animate-pulse rounded bg-muted" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b p-2 md:w-56 md:border-r md:border-b-0 md:p-3">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <PanelNav />
          </Suspense>
        </aside>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

async function EstadoPausa() {
  const supabase = await createClient();
  const { data } = await supabase.from("configuracion").select("pausa_global").eq("id", 1).maybeSingle();
  if (!data) return null;
  return <PausaGlobal activa={data.pausa_global} />;
}

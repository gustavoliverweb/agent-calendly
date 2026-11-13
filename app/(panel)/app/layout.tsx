import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { NavLinks, PanelNav } from "@/components/panel/nav";
import { PausaGlobal } from "@/components/panel/pausa-global";
import { UserMenu } from "@/components/panel/user-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEmpresaActual } from "@/lib/empresa";
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
        <main className="flex-1 p-4 md:p-8">
          <Suspense fallback={null}>
            <AvisoSuspendida />
          </Suspense>
          <Suspense fallback={null}>
            <AvisoSinGuion />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}

async function AvisoSuspendida() {
  const empresa = await getEmpresaActual();
  if (empresa.estado !== "suspendida") return null;
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertDescription>
        La cuenta de {empresa.nombre} está suspendida: no se puede hacer ninguna llamada. Puedes seguir consultando tus
        datos. Para reactivarla, contacta con nosotros.
      </AlertDescription>
    </Alert>
  );
}

async function AvisoSinGuion() {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const { data } = await supabase.from("empresas").select("guion_activo_id").eq("id", empresa.id).maybeSingle();
  if (!data || data.guion_activo_id) return null;
  return (
    <Alert className="mb-6">
      <AlertDescription>
        Tu empresa aún no tiene un guion activo, así que no sale ninguna llamada.{" "}
        <Link href="/app/guion" className="font-medium underline">
          {empresa.rol === "propietario" ? "Créalo en la sección Guion" : "Pide al propietario que lo cree en la sección Guion"}
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}

async function EstadoPausa() {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracion")
    .select("pausa_global")
    .eq("empresa_id", empresa.id)
    .maybeSingle();
  if (!data) return null;
  return <PausaGlobal activa={data.pausa_global} />;
}

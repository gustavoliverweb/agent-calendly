import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { NavLinks, PanelNav } from "@/components/panel/nav";
import { PausaGlobal } from "@/components/panel/pausa-global";
import { UserMenu } from "@/components/panel/user-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { conexionCalendly } from "@/lib/calendly/conexion";
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

/** Pasos que faltan para que la empresa pueda llamar (guion y Calendly). */
async function AvisoSinGuion() {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const [{ data }, calendly] = await Promise.all([
    supabase.from("empresas").select("guion_activo_id").eq("id", empresa.id).maybeSingle(),
    conexionCalendly(empresa.id).catch(() => null),
  ]);
  const pasos: { texto: string; href: string; enlace: string }[] = [];
  if (data && !data.guion_activo_id) {
    pasos.push({ texto: "no tiene un guion activo, así que no sale ninguna llamada", href: "/app/guion", enlace: "Guion" });
  }
  if (!calendly) {
    pasos.push({
      texto: "no tiene Calendly conectado, así que el agente no puede ofrecer huecos ni reservar",
      href: "/app/calendly",
      enlace: "Calendly",
    });
  }
  if (!pasos.length) return null;
  const quien = empresa.rol === "propietario" ? "Puedes resolverlo en" : "Pide al propietario que lo resuelva en";
  return (
    <Alert className="mb-6">
      <AlertDescription>
        <ul className="flex flex-col gap-1">
          {pasos.map((p) => (
            <li key={p.href}>
              Tu empresa {p.texto}. {quien}{" "}
              <Link href={p.href} className="font-medium underline">
                {p.enlace}
              </Link>
              .
            </li>
          ))}
        </ul>
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

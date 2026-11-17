import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/panel/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmpresaActual } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { lineaDeEmpresa } from "@/lib/telefono";

export const metadata: Metadata = { title: "Teléfono" };

export default function TelefonoPage() {
  return (
    <>
      <PageHeader title="Teléfono" description="La línea desde la que llama el agente y cuántas llamadas puede hacer a la vez." />
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const [{ data: emp }, { data: config }, linea] = await Promise.all([
    supabase.from("empresas").select("max_concurrencia_contratada").eq("id", empresa.id).single(),
    supabase.from("configuracion").select("max_concurrencia").eq("empresa_id", empresa.id).single(),
    lineaDeEmpresa(empresa.id),
  ]);
  const contratadas = emp?.max_concurrencia_contratada ?? 1;
  const efectivas = Math.min(config?.max_concurrencia ?? contratadas, contratadas);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Línea
            {linea ? <Badge variant="secondary">Activa</Badge> : <Badge variant="outline">Sin línea</Badge>}
          </CardTitle>
          <CardDescription>Cada empresa llama desde su propia línea, contratada con su operador de telefonía.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {linea ? (
            <p>
              El agente llama desde{" "}
              <span className="font-medium tabular-nums">
                {linea.numero ?? (linea.origen === "entorno" ? "la línea provisional de la plataforma" : "tu línea")}
              </span>
              .
            </p>
          ) : (
            <>
              <p>
                Tu empresa aún no tiene línea, así que el agente no puede llamar por teléfono. Mientras tanto puedes
                preparar el guion, conectar Calendly, importar contactos y{" "}
                <Link href="/app/guion" className="underline">
                  probar el agente en el navegador
                </Link>
                .
              </p>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="font-medium">Cómo darla de alta</p>
                <ol className="mt-1 list-decimal pl-5 text-muted-foreground">
                  <li>Contrata con tu operador una línea SIP (troncal SIP) con el número desde el que quieres llamar.</li>
                  <li>
                    Pide al operador los datos de conexión: servidor o dominio SIP, usuario y contraseña, y si exige
                    registrar una IP.
                  </li>
                  <li>Envíanoslos por un canal seguro: la damos de alta y te avisamos cuando esté lista.</li>
                </ol>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capacidad</CardTitle>
          <CardDescription>
            Los minutos del mes y el límite contratado están en{" "}
            <Link href="/app/uso" className="underline">
              Uso
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <dl className="grid gap-2 sm:grid-cols-[14rem_1fr]">
            <dt className="text-muted-foreground">Llamadas simultáneas</dt>
            <dd>
              {efectivas} (contratadas: {contratadas}; se ajustan en{" "}
              <Link href="/app/configuracion" className="underline">
                Configuración
              </Link>
              )
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

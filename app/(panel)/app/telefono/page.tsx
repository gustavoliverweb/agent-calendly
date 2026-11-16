import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/panel/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmpresaActual } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { lineaDeEmpresa } from "@/lib/telefono";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Teléfono" };

const entero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

export default function TelefonoPage() {
  return (
    <>
      <PageHeader title="Teléfono" description="La línea desde la que llama el agente y el uso de este mes." />
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const [{ data: emp }, { data: minutos }, { data: config }, linea] = await Promise.all([
    supabase.from("empresas").select("limite_minutos_mes, max_concurrencia_contratada").eq("id", empresa.id).single(),
    supabase.rpc("minutos_mes", { p_empresa_id: empresa.id }),
    supabase.from("configuracion").select("max_concurrencia").eq("empresa_id", empresa.id).single(),
    lineaDeEmpresa(empresa.id),
  ]);
  const usados = Number(minutos ?? 0);
  const limite = emp?.limite_minutos_mes ?? null;
  const porcentaje = limite ? Math.min(100, (usados / limite) * 100) : 0;
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
          <CardTitle>Uso de este mes</CardTitle>
          <CardDescription>Minutos de conversación, incluidas las pruebas desde el navegador.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {entero.format(usados)} min
              {limite && <span className="text-base font-normal text-muted-foreground"> de {entero.format(limite)}</span>}
            </p>
            {limite ? (
              <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(porcentaje)} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className={cn("h-full rounded-full", porcentaje >= 100 ? "bg-destructive" : porcentaje >= 80 ? "bg-amber-500" : "bg-primary")}
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
                {porcentaje >= 100 && (
                  <p className="mt-2 text-destructive">
                    Has alcanzado el límite del mes: no sale ninguna llamada hasta el mes que viene. Contacta con nosotros
                    para ampliarlo.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Sin límite mensual.</p>
            )}
          </div>
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

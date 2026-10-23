import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/panel/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Configuración" };

const DIAS = ["", "L", "M", "X", "J", "V", "S", "D"];

type Franja = { dias: number[]; desde: string; hasta: string };

export default function ConfiguracionPage() {
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Reglas de llamada. La edición llega en la fase 6; de momento, solo lectura."
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <ConfiguracionActual />
      </Suspense>
    </>
  );
}

async function ConfiguracionActual() {
  const supabase = await createClient();
  const { data: config, error } = await supabase
    .from("configuracion")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !config) {
    return <p className="text-sm text-destructive">No se ha podido leer la configuración.</p>;
  }

  const franjas = config.franjas as Franja[];
  const festivos = config.festivos as string[];

  const filas: [string, React.ReactNode][] = [
    ["Llamadas simultáneas (máx.)", config.max_concurrencia],
    [
      "Franjas horarias (hora de Madrid)",
      <ul key="f" className="flex flex-col gap-1">
        {franjas.map((f, i) => (
          <li key={i}>
            {f.dias.map((d) => DIAS[d]).join(" ")} · {f.desde}–{f.hasta}
          </li>
        ))}
      </ul>,
    ],
    ["Reintentos si no contesta", `${config.max_reintentos}, separados ${config.horas_entre_reintentos} h`],
    ["Festivos sin llamadas", festivos.length ? festivos.join(", ") : "Ninguno"],
    [
      "Tipo de campaña",
      config.tipo_campana === "comercial"
        ? "Comercial (exige consentimiento)"
        : "No comercial (relación previa)",
    ],
    [
      "Pausa global",
      config.pausa_global ? <Badge variant="destructive">Activada</Badge> : <Badge variant="secondary">Desactivada</Badge>,
    ],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reglas actuales</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          {filas.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-3 sm:grid-cols-[16rem_1fr]">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

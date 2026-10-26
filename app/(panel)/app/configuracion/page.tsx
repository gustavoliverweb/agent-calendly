import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/panel/page-header";
import { FormularioConfiguracion } from "@/components/configuracion/formulario";
import { leerConfiguracion } from "@/lib/calls/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Configuración" };

const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "long", timeStyle: "short" });

export default function ConfiguracionPage() {
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Reglas que aplican a todas las llamadas, manuales y en lote. La pausa global está en la cabecera."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Formulario />
      </Suspense>
    </>
  );
}

async function Formulario() {
  const supabase = await createClient();
  const config = await leerConfiguracion(supabase);
  const inicial = {
    max_concurrencia: config.max_concurrencia,
    franjas: config.franjas,
    festivos: config.festivos,
    max_reintentos: config.max_reintentos,
    horas_entre_reintentos: config.horas_entre_reintentos,
    tipo_campana: config.tipo_campana,
    timeout_llamada_min: config.timeout_llamada_min,
    retencion_transcripciones_dias: config.retencion_transcripciones_dias,
    retencion_webhooks_dias: config.retencion_webhooks_dias,
  };
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <p className="text-xs text-muted-foreground">Última modificación: {fecha.format(new Date(config.actualizado_en))}</p>
      {/* key: tras guardar, el formulario parte de los valores nuevos (y la
          pausa global, que también toca esta fila, no borra lo que se edita). */}
      <FormularioConfiguracion key={JSON.stringify(inicial)} inicial={inicial} />
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckCircle2Icon, CircleDashedIcon } from "lucide-react";
import { PageHeader } from "@/components/panel/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  appEnv,
  calendlyEnv,
  calendlyWebhookEnv,
  elevenLabsEnv,
  elevenLabsWebhookEnv,
  isConfigured,
  supabaseEnv,
} from "@/lib/env";

export const metadata: Metadata = { title: "Resumen" };

export default function ResumenPage() {
  return (
    <>
      <PageHeader title="Resumen" description="Estado del sistema y actividad reciente." />
      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <ContactosCard />
        </Suspense>
        <IntegracionesCard />
      </div>
    </>
  );
}

async function ContactosCard() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("contactos")
    .select("*", { count: "exact", head: true });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contactos</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">No se ha podido leer la base de datos.</p>
        ) : (
          <p className="text-3xl font-semibold tabular-nums">{count ?? 0}</p>
        )}
      </CardContent>
    </Card>
  );
}

function IntegracionesCard() {
  const items = [
    { nombre: "Base de datos (Supabase)", ok: isConfigured(supabaseEnv) },
    { nombre: "Ajustes de la app", ok: isConfigured(appEnv) },
    { nombre: "Agente de voz (ElevenLabs)", ok: isConfigured(elevenLabsEnv) },
    { nombre: "Webhook de ElevenLabs", ok: isConfigured(elevenLabsWebhookEnv) },
    { nombre: "Agenda (Calendly)", ok: isConfigured(calendlyEnv) },
    { nombre: "Webhook de Calendly", ok: isConfigured(calendlyWebhookEnv) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integraciones</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {items.map(({ nombre, ok }) => (
            <li key={nombre} className="flex items-center gap-2">
              {ok ? (
                <CheckCircle2Icon className="size-4 text-green-600" />
              ) : (
                <CircleDashedIcon className="size-4 text-muted-foreground" />
              )}
              <span>{nombre}</span>
              <span className="ml-auto text-muted-foreground">
                {ok ? "Configurada" : "Pendiente"}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CardSkeleton() {
  return <div className="h-36 animate-pulse rounded-xl bg-muted" />;
}

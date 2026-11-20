import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { CatalogoVoces } from "@/components/admin/catalogo-voces";
import { PageHeader } from "@/components/panel/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireAdminPlataforma } from "@/lib/admin";
import { overrideVozActivada } from "@/lib/elevenlabs/client";
import { elevenLabsAgenteEnv, isConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { usoDeVoces } from "@/lib/voces";

export const metadata: Metadata = { title: "Voces" };

export default function VocesPage() {
  return (
    <div className="flex flex-col">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Empresas
      </Link>
      <PageHeader
        title="Voces"
        description="Las voces que cada empresa puede elegir en su guion. Además de estas, siempre está la voz por defecto del agente."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  await requireAdminPlataforma();
  const configurado = isConfigured(elevenLabsAgenteEnv);
  const [{ data: voces, error }, uso, override] = await Promise.all([
    createAdminClient().from("voces").select("id, voice_id, nombre, descripcion, muestra_url, activa").order("orden").order("nombre"),
    usoDeVoces(),
    configurado ? overrideVozActivada() : Promise.resolve(null),
  ]);
  if (error) throw new Error(`No se pudo cargar el catálogo de voces: ${error.message}`);
  const hayVoces = (voces ?? []).some((v) => v.activa);

  return (
    <div className="flex flex-col gap-6">
      {!configurado ? (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>ElevenLabs no está configurado: no se pueden añadir voces.</AlertDescription>
        </Alert>
      ) : override === false ? (
        <Alert variant={hayVoces ? "destructive" : "default"}>
          <CircleAlertIcon />
          <AlertDescription>
            El agente de ElevenLabs no permite cambiar la voz por llamada. Actívalo en ElevenLabs → el agente → Security →
            Overrides → Voice; si no, las llamadas de las empresas que elijan otra voz fallarán.
          </AlertDescription>
        </Alert>
      ) : override == null ? (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            No se ha podido comprobar si el agente permite cambiar la voz por llamada (Security → Overrides → Voice).
            Compruébalo en ElevenLabs antes de ofrecer voces.
          </AlertDescription>
        </Alert>
      ) : null}

      <CatalogoVoces
        voces={(voces ?? []).map((v) => ({
          id: v.id,
          voiceId: v.voice_id,
          nombre: v.nombre,
          descripcion: v.descripcion,
          muestra: Boolean(v.muestra_url),
          activa: v.activa,
          enUso: uso.get(v.voice_id) ?? 0,
        }))}
        puedeAnadir={configurado}
      />
    </div>
  );
}

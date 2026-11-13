import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/panel/page-header";
import { EditorGuion, type VersionGuion } from "@/components/guion/editor";
import { getEmpresaActual } from "@/lib/empresa";
import { elevenLabsAgenteEnv, isConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Guion" };

/** Versiones que se muestran en el historial. */
const MAX_VERSIONES = 30;

export default function GuionPage() {
  return (
    <>
      <PageHeader
        title="Guion"
        description="Lo que el agente cuenta de tu negocio. La parte técnica y legal de la llamada es común y no se edita."
      />
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const [{ data: emp }, { data: versiones }, { data: contactos }] = await Promise.all([
    supabase.from("empresas").select("guion_activo_id").eq("id", empresa.id).single(),
    supabase
      .from("guiones")
      .select(
        "id, version, creado_en, negocio_nombre, nombre_agente, primer_mensaje, voz_id, negocio, motivo, oferta, cita, preguntas, objeciones, limites, texto",
      )
      .eq("empresa_id", empresa.id)
      .order("version", { ascending: false })
      .limit(MAX_VERSIONES),
    supabase
      .from("contactos")
      .select("id, nombre, telefono, email")
      .eq("empresa_id", empresa.id)
      .neq("estado", "no_llamar")
      .order("creado_en", { ascending: false })
      .limit(200),
  ]);

  return (
    <EditorGuion
      versiones={(versiones ?? []) as VersionGuion[]}
      activoId={emp?.guion_activo_id ?? null}
      puedeEditar={empresa.rol === "propietario"}
      contactos={contactos ?? []}
      pruebaDisponible={isConfigured(elevenLabsAgenteEnv)}
    />
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/panel/page-header";
import { PanelCalendly, type EstadoCalendly } from "@/components/calendly/panel";
import { tiposDeEvento, tokenGestion, type TipoEvento } from "@/lib/calendly/cuenta";
import { getEmpresaActual, empresaPrincipalId } from "@/lib/empresa";
import { calendlyEnv, calendlyOAuthEnv, isConfigured } from "@/lib/env";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Calendly" };

export default function CalendlyPage({ searchParams }: PageProps<"/app/calendly">) {
  return (
    <>
      <PageHeader
        title="Calendly"
        description="El calendario en el que el agente consulta los huecos libres y reserva las citas."
      />
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/app/calendly">["searchParams"] }) {
  const q = await searchParams;
  const empresa = await getEmpresaActual();
  // Service role tras comprobar la empresa del usuario: la tabla guarda tokens.
  const { data: fila } = await createAdminClient()
    .from("integraciones_calendly")
    .select(
      "estado, cuenta_nombre, cuenta_email, usuario_uri, event_type_uri, event_type_nombre, ubicacion_kind, webhook_uri, ultimo_error, ultimo_error_en, conectado_en",
    )
    .eq("empresa_id", empresa.id)
    .maybeSingle();

  let tipos: TipoEvento[] = [];
  let errorTipos = false;
  if (fila && fila.estado !== "desconectada" && fila.usuario_uri && empresa.rol === "propietario") {
    try {
      const token = await tokenGestion(empresa.id);
      if (token) tipos = await tiposDeEvento(token, fila.usuario_uri);
    } catch (e) {
      errorTipos = true;
      log.warn("calendly: listar tipos de evento", { empresa_id: empresa.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const estado: EstadoCalendly = fila
    ? {
        estado: fila.estado as EstadoCalendly["estado"],
        cuenta: fila.cuenta_nombre,
        email: fila.cuenta_email,
        tipoUri: fila.event_type_uri,
        tipoNombre: fila.event_type_nombre,
        ubicacionKind: fila.ubicacion_kind,
        webhook: Boolean(fila.webhook_uri),
        ultimoError: fila.ultimo_error,
        conectadoEn: fila.conectado_en,
      }
    : { estado: "sin_conectar" };

  const provisional =
    estado.estado !== "conectada" && isConfigured(calendlyEnv) && empresa.id === (await empresaPrincipalId());

  return (
    <PanelCalendly
      estado={estado}
      tipos={tipos}
      errorTipos={errorTipos}
      puedeEditar={empresa.rol === "propietario"}
      oauthDisponible={isConfigured(calendlyOAuthEnv)}
      provisional={provisional}
      aviso={typeof q.error === "string" ? q.error : q.conectado ? "conectado" : null}
    />
  );
}

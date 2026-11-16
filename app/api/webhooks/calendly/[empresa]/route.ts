import type { NextRequest } from "next/server";
import { z } from "zod";
import { manejarWebhookCalendly } from "@/lib/calendly/webhook-http";
import { calendlyOAuthEnv, isConfigured } from "@/lib/env";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook del Calendly que conectó cada empresa (S4). La URL identifica la
 * empresa: la crea la app al conectar y solo Calendly la firma, con la clave
 * de la app OAuth.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/webhooks/calendly/[empresa]">) {
  const { empresa } = await ctx.params;
  if (!z.uuid().safeParse(empresa).success || !isConfigured(calendlyOAuthEnv)) {
    return new Response(null, { status: 404 });
  }

  const { data: integracion } = await createAdminClient()
    .from("integraciones_calendly")
    .select("estado, event_type_uri")
    .eq("empresa_id", empresa)
    .maybeSingle();
  if (!integracion || integracion.estado === "desconectada") {
    // Suscripción de una cuenta ya desconectada: se acepta sin hacer nada para que Calendly no reintente.
    log.warn("webhook calendly de una empresa sin Calendly conectado", { empresa_id: empresa });
    return Response.json({ ok: true, ignorado: "sin_integracion" });
  }

  return manejarWebhookCalendly(req, {
    secreto: calendlyOAuthEnv().CALENDLY_OAUTH_WEBHOOK_SIGNING_KEY,
    empresaId: empresa,
    eventTypeUri: integracion.event_type_uri,
    origen: "oauth",
  });
}

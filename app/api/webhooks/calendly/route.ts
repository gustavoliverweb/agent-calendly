import { manejarWebhookCalendly } from "@/lib/calendly/webhook-http";
import { calendlyEnv, calendlyWebhookEnv, isConfigured } from "@/lib/env";
import { empresaPrincipalId } from "@/lib/empresa";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook del Calendly "de entorno" (transitorio): el de la empresa principal
 * antes de la S4. En cuanto la principal conecta su cuenta por OAuth, los
 * eventos llegan por /api/webhooks/calendly/<empresa> y este se ignora (luego
 * se borra la suscripción antigua con `pnpm calendly borrar-webhook`).
 */
export async function POST(req: Request) {
  if (!isConfigured(calendlyWebhookEnv)) return new Response(null, { status: 404 });
  const empresaId = await empresaPrincipalId();

  const { data: oauth } = await createAdminClient()
    .from("integraciones_calendly")
    .select("estado")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (oauth?.estado === "conectada") return Response.json({ ok: true, ignorado: "calendly_por_oauth" });

  return manejarWebhookCalendly(req, {
    secreto: calendlyWebhookEnv().CALENDLY_WEBHOOK_SIGNING_KEY,
    empresaId,
    eventTypeUri: isConfigured(calendlyEnv) ? calendlyEnv().CALENDLY_EVENT_TYPE_URI : null,
    origen: "entorno",
  });
}

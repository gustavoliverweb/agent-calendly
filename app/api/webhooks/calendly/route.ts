import { procesarWebhookCalendly, webhookCalendlySchema } from "@/lib/calendly/webhook";
import { calendlyEnv, calendlyWebhookEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { verificarFirma } from "@/lib/security/hmac";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

const MAX_BODY = 256 * 1024;
/** Tolerancia que recomienda Calendly para el timestamp de la firma. */
const TOLERANCIA_SEG = 180;

/** Webhook de Calendly: citas creadas, canceladas y reprogramadas. */
export async function POST(req: Request) {
  const cuerpo = await req.text();
  if (cuerpo.length > MAX_BODY) return new Response(null, { status: 413 });

  const firma = verificarFirma({
    cabecera: req.headers.get("calendly-webhook-signature"),
    cuerpo,
    secreto: calendlyWebhookEnv().CALENDLY_WEBHOOK_SIGNING_KEY,
    version: "v1",
    toleranciaSeg: TOLERANCIA_SEG,
  });
  if (!firma.ok) {
    log.warn("webhook calendly rechazado", { motivo: firma.motivo });
    return new Response(null, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(cuerpo);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = webhookCalendlySchema.safeParse(json);
  if (!parsed.success) {
    // Firmado pero con una forma que no esperamos: registrarlo y no reintentar.
    log.error("webhook calendly con forma inesperada", { campos: parsed.error.issues.map((i) => i.path.join(".")) });
    return Response.json({ ok: true, ignorado: true });
  }
  const evento = parsed.data;

  const supabase = createAdminClient();
  const idExterno = `${evento.event}:${evento.payload.uri}`;
  const insertado = await supabase
    .from("eventos_webhook")
    .insert({ origen: "calendly", id_externo: idExterno, tipo: evento.event, payload: json as Json })
    .select("id")
    .single();

  let eventoId: string;
  if (insertado.error) {
    if (insertado.error.code !== "23505") {
      log.error("webhook calendly: no se pudo registrar", { code: insertado.error.code });
      return new Response(null, { status: 500 });
    }
    // Ya recibido. Si se procesó, es un reintento; si falló, se reintenta aquí.
    const { data: previo } = await supabase
      .from("eventos_webhook")
      .select("id, procesado_en")
      .eq("origen", "calendly")
      .eq("id_externo", idExterno)
      .single();
    if (!previo) return new Response(null, { status: 500 });
    if (previo.procesado_en) return Response.json({ ok: true, duplicado: true });
    eventoId = previo.id;
  } else {
    eventoId = insertado.data.id;
  }

  try {
    const resultado = await procesarWebhookCalendly(evento, calendlyEnv().CALENDLY_EVENT_TYPE_URI);
    await supabase
      .from("eventos_webhook")
      .update({ procesado_en: new Date().toISOString(), error: null })
      .eq("id", eventoId);
    log.info("webhook calendly", { evento: evento.event, resultado });
    return Response.json({ ok: true, resultado });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await supabase.from("eventos_webhook").update({ error: mensaje.slice(0, 1000) }).eq("id", eventoId);
    log.error("webhook calendly: error al procesar", { evento: evento.event, error: mensaje });
    // 500: Calendly reintenta y el evento se reprocesa (es idempotente).
    return new Response(null, { status: 500 });
  }
}

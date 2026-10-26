import { after } from "next/server";
import { despachar } from "@/lib/calls/dispatcher";
import { procesarWebhookElevenLabs, webhookElevenLabsSchema } from "@/lib/calls/post-call";
import { elevenLabsWebhookEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { verificarFirma } from "@/lib/security/hmac";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/** Una transcripción larga puede ocupar bastante; el audio no se suscribe. */
const MAX_BODY = 5 * 1024 * 1024;
/** Ventana de ElevenLabs para el timestamp de la firma. */
const TOLERANCIA_SEG = 30 * 60;

/** Webhook post-llamada de ElevenLabs: transcripción y análisis, o fallo al iniciar. */
export async function POST(req: Request) {
  const cuerpo = await req.text();
  if (cuerpo.length > MAX_BODY) return new Response(null, { status: 413 });

  const firma = verificarFirma({
    cabecera: req.headers.get("elevenlabs-signature"),
    cuerpo,
    secreto: elevenLabsWebhookEnv().ELEVENLABS_WEBHOOK_SECRET,
    version: "v0",
    toleranciaSeg: TOLERANCIA_SEG,
  });
  if (!firma.ok) {
    log.warn("webhook elevenlabs rechazado", { motivo: firma.motivo });
    return new Response(null, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(cuerpo);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = webhookElevenLabsSchema.safeParse(json);
  if (!parsed.success) {
    log.error("webhook elevenlabs con forma inesperada", { campos: parsed.error.issues.map((i) => i.path.join(".")) });
    return Response.json({ ok: true, ignorado: true });
  }
  const evento = parsed.data;
  if (evento.type !== "post_call_transcription" && evento.type !== "call_initiation_failure") {
    return Response.json({ ok: true, ignorado: true });
  }

  const supabase = createAdminClient();
  const idExterno = `${evento.type}:${evento.data.conversation_id}`;
  const insertado = await supabase
    .from("eventos_webhook")
    .insert({ origen: "elevenlabs", id_externo: idExterno, tipo: evento.type, payload: json as Json })
    .select("id")
    .single();

  let eventoId: string;
  if (insertado.error) {
    if (insertado.error.code !== "23505") {
      log.error("webhook elevenlabs: no se pudo registrar", { code: insertado.error.code });
      return new Response(null, { status: 500 });
    }
    const { data: previo } = await supabase
      .from("eventos_webhook")
      .select("id, procesado_en")
      .eq("origen", "elevenlabs")
      .eq("id_externo", idExterno)
      .single();
    if (!previo) return new Response(null, { status: 500 });
    if (previo.procesado_en) return Response.json({ ok: true, duplicado: true });
    eventoId = previo.id;
  } else {
    eventoId = insertado.data.id;
  }

  try {
    const r = await procesarWebhookElevenLabs(evento);
    if (r.resultado === "llamada_desconocida") {
      // Queda registrado sin procesar: al guardar el conversation_id de la
      // llamada se reprocesa (procesarEventosPendientes).
      await supabase.from("eventos_webhook").update({ error: "llamada no encontrada (pendiente)" }).eq("id", eventoId);
      log.warn("webhook elevenlabs sin llamada", { conversation_id: evento.data.conversation_id, tipo: evento.type });
      return Response.json({ ok: true, pendiente: true });
    }
    await supabase
      .from("eventos_webhook")
      .update({ procesado_en: new Date().toISOString(), error: null })
      .eq("id", eventoId);
    // Se liberó un hueco de un lote: la cola avanza sin esperar al cron.
    if (r.resultado === "procesado" && r.loteId) after(() => despachar());
    return Response.json({ ok: true, resultado: r.resultado });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await supabase.from("eventos_webhook").update({ error: mensaje.slice(0, 1000) }).eq("id", eventoId);
    log.error("webhook elevenlabs: error al procesar", { tipo: evento.type, error: mensaje });
    return new Response(null, { status: 500 });
  }
}

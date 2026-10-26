import "server-only";
import { z } from "zod";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { leerConfiguracion } from "./config";
import { decidirItemLote, decidirResultado, esBuzon, leerDatosRecogidos, type EventoLlamada } from "./outcome";

const turnoSchema = z
  .object({
    role: z.string(),
    message: z.string().nullish(),
    time_in_call_secs: z.number().nullish(),
    tool_calls: z.array(z.object({ tool_name: z.string().nullish() }).loose()).nullish(),
    tool_results: z
      .array(z.object({ tool_name: z.string().nullish(), is_error: z.boolean().nullish() }).loose())
      .nullish(),
  })
  .loose();

export const webhookElevenLabsSchema = z.object({
  type: z.string(),
  event_timestamp: z.number().nullish(),
  data: z
    .object({
      conversation_id: z.string(),
      transcript: z.array(turnoSchema).nullish(),
      metadata: z
        .object({
          start_time_unix_secs: z.number().nullish(),
          call_duration_secs: z.number().nullish(),
          termination_reason: z.string().nullish(),
          phone_call: z.object({ call_result: z.string().nullish() }).loose().nullish(),
        })
        .loose()
        .nullish(),
      analysis: z
        .object({
          call_successful: z.string().nullish(),
          transcript_summary: z.string().nullish(),
          evaluation_criteria_results: z.unknown().optional(),
          data_collection_results: z.unknown().optional(),
        })
        .loose()
        .nullish(),
      conversation_initiation_client_data: z
        .object({ dynamic_variables: z.record(z.string(), z.unknown()).nullish() })
        .loose()
        .nullish(),
      failure_reason: z.string().nullish(),
    })
    .loose(),
});

export type WebhookElevenLabs = z.infer<typeof webhookElevenLabsSchema>;

export type ResultadoPostLlamada =
  | { resultado: "procesado"; loteId: string | null }
  | { resultado: "llamada_desconocida" | "ignorado" };

const COLUMNAS_LLAMADA = "id, contacto_id, estado, clasificacion, cita_agendada, finalizada_en, conversation_id, lote_id";

export type LlamadaAbierta = {
  id: string;
  contacto_id: string;
  clasificacion: string | null;
  cita_agendada: boolean;
  finalizada_en: string | null;
  lote_id: string | null;
};

/** Transcripción para guardar: solo lo útil para leerla en el panel. */
function transcripcionLimpia(turnos: z.infer<typeof turnoSchema>[]) {
  return turnos.map((t) => ({
    role: t.role,
    message: t.message ?? null,
    time_in_call_secs: t.time_in_call_secs ?? null,
    ...(t.tool_calls?.length ? { tools: t.tool_calls.map((c) => c.tool_name ?? "?") } : {}),
    ...(t.tool_results?.some((r) => r.is_error) ? { tool_error: true } : {}),
  }));
}

/**
 * Aplica un webhook de ElevenLabs (fin de llamada o fallo al iniciarla) a la
 * llamada y al contacto. Idempotente: reaplicarlo deja el mismo estado, salvo
 * `intentos`, que solo se incrementa si la llamada no estaba ya finalizada.
 */
export async function procesarWebhookElevenLabs(w: WebhookElevenLabs): Promise<ResultadoPostLlamada> {
  if (w.type !== "post_call_transcription" && w.type !== "call_initiation_failure") return { resultado: "ignorado" };
  const supabase = createAdminClient();
  const d = w.data;

  let { data: llamada } = await supabase
    .from("llamadas")
    .select(COLUMNAS_LLAMADA)
    .eq("conversation_id", d.conversation_id)
    .maybeSingle();
  // Respaldo: el webhook llegó antes de que se guardara conversation_id.
  const llamadaIdVar = d.conversation_initiation_client_data?.dynamic_variables?.llamada_id;
  if (!llamada && typeof llamadaIdVar === "string" && z.uuid().safeParse(llamadaIdVar).success) {
    ({ data: llamada } = await supabase.from("llamadas").select(COLUMNAS_LLAMADA).eq("id", llamadaIdVar).maybeSingle());
  }
  if (!llamada) return { resultado: "llamada_desconocida" };
  await aplicarEvento(llamada, w);
  return { resultado: "procesado", loteId: llamada.lote_id };
}

/**
 * Aplica el fin (o el fallo) de una llamada ya localizada: la propia
 * llamada, el contacto y, si viene de un lote, su item. También lo usa la
 * reconciliación de llamadas sin webhook.
 */
export async function aplicarEvento(llamada: LlamadaAbierta, w: WebhookElevenLabs) {
  const supabase = createAdminClient();
  const d = w.data;

  const { data: contacto, error: errContacto } = await supabase
    .from("contactos")
    .select("estado, intentos")
    .eq("id", llamada.contacto_id)
    .single();
  if (errContacto || !contacto) throw new Error(`contacto: ${errContacto?.message}`);
  const config = await leerConfiguracion(supabase);

  const turnos = d.transcript ?? [];
  const evento: EventoLlamada =
    w.type === "call_initiation_failure"
      ? { tipo: "fallo_inicio", motivo: d.failure_reason ?? "unknown" }
      : {
          tipo: "fin",
          hablo: turnos.some((t) => t.role === "user" && t.message?.trim()),
          buzon: esBuzon(d.metadata?.termination_reason, d.metadata?.phone_call?.call_result),
          datos: leerDatosRecogidos(d.analysis?.data_collection_results),
        };

  const decision = decidirResultado(evento, {
    citaAgendada: llamada.cita_agendada,
    clasificacionPrevia: llamada.clasificacion,
    contactoEstado: contacto.estado,
    intentos: contacto.intentos,
    maxReintentos: config.max_reintentos,
  });

  const inicio = d.metadata?.start_time_unix_secs;
  const duracion = d.metadata?.call_duration_secs;
  const finalizada =
    inicio != null && duracion != null
      ? new Date((inicio + duracion) * 1000)
      : new Date((w.event_timestamp ?? Date.now() / 1000) * 1000);

  const { error: errLlamada } = await supabase
    .from("llamadas")
    .update({
      ...(d.conversation_id ? { conversation_id: d.conversation_id } : {}),
      estado: decision.llamada.estado,
      clasificacion: decision.llamada.clasificacion,
      finalizada_en: finalizada.toISOString(),
      webhook_recibido_en: new Date().toISOString(),
      ...(evento.tipo === "fallo_inicio"
        ? { motivo_fallo: evento.motivo }
        : {
            duracion_seg: duracion != null ? Math.round(duracion) : null,
            resultado: d.analysis?.transcript_summary ?? null,
            transcripcion: transcripcionLimpia(turnos) as Json,
            analisis: {
              call_successful: d.analysis?.call_successful ?? null,
              evaluation_criteria_results: (d.analysis?.evaluation_criteria_results ?? null) as Json,
              data_collection_results: (d.analysis?.data_collection_results ?? null) as Json,
              termination_reason: d.metadata?.termination_reason ?? null,
            },
          }),
    })
    .eq("id", llamada.id);
  if (errLlamada) throw new Error(`llamadas: ${errLlamada.message}`);

  // Reprocesar el mismo webhook no debe contar dos veces el intento.
  const yaFinalizada = llamada.finalizada_en != null;
  if (decision.contacto.tipo === "no_llamar") {
    const { error } = await supabase.rpc("marcar_no_llamar", {
      p_contacto_id: llamada.contacto_id,
      p_origen: "agente_post_llamada",
    });
    if (error) throw new Error(`marcar_no_llamar: ${error.message}`);
  } else if (decision.contacto.tipo === "actualizar" && !(yaFinalizada && decision.sinRespuesta)) {
    const { error } = await supabase
      .from("contactos")
      .update(decision.contacto.campos)
      .eq("id", llamada.contacto_id)
      .neq("estado", "no_llamar");
    if (error) throw new Error(`contactos: ${error.message}`);
  }

  // Solo el item que sigue esperando a esta llamada: reprocesar no lo mueve.
  if (llamada.lote_id) {
    const cambio = decidirItemLote(decision, new Date(), config);
    const { error } = await supabase
      .from("lote_items")
      .update(cambio)
      .eq("ultima_llamada_id", llamada.id)
      .eq("estado", "en_llamada");
    if (error) throw new Error(`lote_items: ${error.message}`);
  }

  log.info("llamada finalizada", {
    llamada_id: llamada.id,
    conversation_id: d.conversation_id,
    estado: decision.llamada.estado,
    clasificacion: decision.llamada.clasificacion,
    duracion_seg: duracion,
  });
}

/**
 * Reprocesa webhooks que llegaron antes de que la llamada tuviera
 * conversation_id (quedaron registrados sin procesar).
 */
export async function procesarEventosPendientes(conversationId: string) {
  const supabase = createAdminClient();
  const { data: pendientes } = await supabase
    .from("eventos_webhook")
    .select("id, payload")
    .eq("origen", "elevenlabs")
    .in("id_externo", [`post_call_transcription:${conversationId}`, `call_initiation_failure:${conversationId}`])
    .is("procesado_en", null);
  for (const ev of pendientes ?? []) {
    const parsed = webhookElevenLabsSchema.safeParse(ev.payload);
    if (!parsed.success) continue;
    try {
      const r = await procesarWebhookElevenLabs(parsed.data);
      if (r.resultado !== "llamada_desconocida") {
        await supabase.from("eventos_webhook").update({ procesado_en: new Date().toISOString(), error: null }).eq("id", ev.id);
      }
    } catch (e) {
      log.error("reproceso de webhook pendiente falló", { conversation_id: conversationId, error: String(e) });
    }
  }
}

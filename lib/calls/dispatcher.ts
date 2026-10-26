import "server-only";
import { elevenLabsEnv, isConfigured } from "@/lib/env";
import { ElevenLabsError, obtenerConversacion } from "@/lib/elevenlabs/client";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { leerConfiguracion, type Configuracion } from "./config";
import { iniciarConversacion } from "./launch";
import { aplicarEvento, webhookElevenLabsSchema, type LlamadaAbierta, type WebhookElevenLabs } from "./post-call";
import { siguienteInicioFranja, estaEnFranja } from "./window";

export type ResumenDespacho = {
  lanzadas: number;
  fallidas: number;
  reconciliadas: number;
  lotesCerrados: number;
  /** Por qué no se lanzó nada, si es el caso. */
  parado?: "pausa_global" | "fuera_de_franja" | "sin_configurar";
};

/** Tras un error de la API, cuándo se vuelve a probar. */
const ESPERA_TRAS_ERROR_MS = 10 * 60_000;
/** Errores de API tolerados por item (no son intentos del contacto). */
const MAX_ERRORES_API = 3;
/** Llamadas colgadas que se revisan por pasada (cada una es un GET a ElevenLabs). */
const RECONCILIAR_POR_PASADA = 20;

/**
 * Una pasada del motor de lotes (§9.2): reconcilia llamadas sin webhook,
 * reclama tantos items como huecos libres haya y lanza sus llamadas.
 * Se puede llamar a la vez desde varios sitios (cron, webhook, panel): la
 * reserva en BD está serializada. No lanza excepciones.
 */
export async function despachar(ahora = new Date()): Promise<ResumenDespacho> {
  const resumen: ResumenDespacho = { lanzadas: 0, fallidas: 0, reconciliadas: 0, lotesCerrados: 0 };
  const supabase = createAdminClient();
  try {
    const config = await leerConfiguracion(supabase);
    const configurado = isConfigured(elevenLabsEnv);
    if (configurado) resumen.reconciliadas = await reconciliar(config, ahora);

    if (config.pausa_global) resumen.parado = "pausa_global";
    else if (!estaEnFranja(ahora, config)) resumen.parado = "fuera_de_franja";
    else if (!configurado) resumen.parado = "sin_configurar";
    else {
      const { data: reservas, error } = await supabase.rpc("reservar_llamadas_lote");
      if (error) throw new Error(`reservar_llamadas_lote: ${error.message}`);

      const resultados = await Promise.all(
        (reservas ?? []).map(async (r) => {
          const res = await iniciarConversacion({
            llamadaId: r.llamada_id,
            contacto: { id: r.contacto_id, nombre: r.nombre, telefono: r.telefono, email: r.email },
            ahora,
            loteId: r.lote_id,
          });
          if (!res.ok) await reprogramarTrasError(r.item_id, res.error, ahora, config);
          return res.ok;
        }),
      );
      resumen.lanzadas = resultados.filter(Boolean).length;
      resumen.fallidas = resultados.length - resumen.lanzadas;
    }

    const { data: cerrados, error: errCerrar } = await supabase.rpc("cerrar_lotes_terminados");
    if (errCerrar) throw new Error(`cerrar_lotes_terminados: ${errCerrar.message}`);
    resumen.lotesCerrados = cerrados ?? 0;
  } catch (e) {
    log.error("despacho falló", { error: e instanceof Error ? e.message : String(e) });
  }

  if (resumen.lanzadas || resumen.fallidas || resumen.reconciliadas || resumen.lotesCerrados) {
    log.info("despacho", resumen);
  }
  return resumen;
}

/**
 * La API no inició la llamada (no es un intento del contacto). Un error
 * permanente (4xx: número rechazado, configuración) abandona el item; uno
 * temporal lo reintenta en unos minutos, hasta MAX_ERRORES_API veces.
 */
async function reprogramarTrasError(itemId: string, error: unknown, ahora: Date, config: Configuracion) {
  const supabase = createAdminClient();
  const status = error instanceof ElevenLabsError ? error.status : undefined;
  const permanente = status != null && status >= 400 && status < 500 && status !== 408 && status !== 429;

  // intentos del item cuenta cada vez que se reclamó, también las fallidas
  // por la API; el límite deja margen para MAX_ERRORES_API además de los
  // intentos reales.
  const { data: item } = await supabase.from("lote_items").select("intentos").eq("id", itemId).single();
  const agotado = (item?.intentos ?? 0) >= config.max_reintentos + 1 + MAX_ERRORES_API;
  const proximo = siguienteInicioFranja(new Date(ahora.getTime() + ESPERA_TRAS_ERROR_MS), config);

  const cambio =
    permanente || agotado || !proximo
      ? { estado: "fallido" as const, motivo_omision: "error_api", proximo_intento_en: null }
      : { estado: "esperando_reintento" as const, proximo_intento_en: proximo.toISOString() };
  await supabase.from("lote_items").update(cambio).eq("id", itemId).eq("estado", "en_llamada");
}

/**
 * Llamadas que siguen abiertas pasado timeout_llamada_min (§9.2 paso 3): se
 * pregunta a ElevenLabs por la conversación y se aplica como si hubiera
 * llegado el webhook. Si no hay datos, se cierran como fallidas por timeout.
 */
async function reconciliar(config: Configuracion, ahora: Date): Promise<number> {
  const supabase = createAdminClient();
  const limite = new Date(ahora.getTime() - config.timeout_llamada_min * 60_000);
  const { data: colgadas, error } = await supabase
    .from("llamadas")
    .select("id, contacto_id, clasificacion, cita_agendada, finalizada_en, lote_id, conversation_id, creado_en")
    .in("estado", ["iniciada", "en_curso"])
    .lt("creado_en", limite.toISOString())
    .order("creado_en")
    .limit(RECONCILIAR_POR_PASADA);
  if (error) throw new Error(`reconciliar: ${error.message}`);

  let n = 0;
  for (const llamada of colgadas ?? []) {
    try {
      const evento = await eventoReconciliado(llamada, config, ahora);
      if (!evento) continue;
      await aplicarEvento(llamada satisfies LlamadaAbierta, evento);
      n++;
      log.warn("llamada reconciliada sin webhook", { llamada_id: llamada.id, tipo: evento.type });
    } catch (e) {
      log.error("reconciliación falló", { llamada_id: llamada.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return n;
}

/** El evento a aplicar a una llamada colgada, o null si hay que seguir esperando. */
async function eventoReconciliado(
  llamada: { id: string; conversation_id: string | null; creado_en: string },
  config: Configuracion,
  ahora: Date,
): Promise<WebhookElevenLabs | null> {
  const timeout = (): WebhookElevenLabs => ({
    type: "call_initiation_failure",
    data: { conversation_id: llamada.conversation_id ?? "", failure_reason: "timeout" },
  });
  // Nunca llegó a tener conversación (p. ej. el proceso murió al lanzarla).
  if (!llamada.conversation_id) return timeout();

  let conversacion;
  try {
    conversacion = await obtenerConversacion(llamada.conversation_id);
  } catch (e) {
    if (e instanceof ElevenLabsError && e.status === 404) return timeout();
    throw e;
  }

  if (conversacion.status === "done" || conversacion.status === "failed") {
    const parsed = webhookElevenLabsSchema.safeParse({ type: "post_call_transcription", data: conversacion });
    if (!parsed.success) throw new Error("conversación con forma inesperada");
    return parsed.data;
  }
  // Sigue en curso o procesando el análisis: se espera hasta el doble del
  // timeout antes de darla por perdida.
  const muyVieja = new Date(llamada.creado_en).getTime() < ahora.getTime() - 2 * config.timeout_llamada_min * 60_000;
  return muyVieja ? timeout() : null;
}

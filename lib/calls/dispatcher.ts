import "server-only";
import { elevenLabsAgenteEnv, isConfigured } from "@/lib/env";
import { ElevenLabsError, obtenerConversacion } from "@/lib/elevenlabs/client";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { lineaDeEmpresa } from "@/lib/telefono";
import { leerConfiguracion, type Configuracion } from "./config";
import { iniciarConversacion } from "./launch";
import { aplicarEvento, webhookElevenLabsSchema, type LlamadaAbierta, type WebhookElevenLabs } from "./post-call";
import { siguienteInicioFranja, estaEnFranja } from "./window";
import { calcularCuota } from "./reparto";

type MotivoParada = "pausa_global" | "fuera_de_franja" | "sin_configurar" | "sin_guion" | "sin_linea";

export type ResumenDespacho = {
  lanzadas: number;
  fallidas: number;
  reconciliadas: number;
  lotesCerrados: number;
  /** Resultado de la purga de retención, si tocaba hoy. */
  purga?: unknown;
  /** Empresas en las que no se lanzó nada y por qué (clave: id de empresa). */
  paradas?: Record<string, MotivoParada>;
};

/** Tras un error de la API, cuándo se vuelve a probar. */
const ESPERA_TRAS_ERROR_MS = 10 * 60_000;
/** Errores de API tolerados por item (no son intentos del contacto). */
const MAX_ERRORES_API = 3;
/** Llamadas colgadas que se revisan por pasada y empresa (cada una es un GET a ElevenLabs). */
const RECONCILIAR_POR_PASADA = 20;
/** La purga de retención va en la misma tarea programada, una vez al día. */
const CADA_PURGA_MS = 24 * 3_600_000;

/**
 * Una pasada del motor de lotes (§9.2) por cada empresa activa: reconcilia
 * llamadas sin webhook, reclama tantos items como huecos libres tenga y
 * lanza sus llamadas. Se puede llamar a la vez desde varios sitios (cron,
 * webhook, panel): la reserva en BD está serializada. No lanza excepciones;
 * el fallo de una empresa no para a las demás.
 *
 * Reparto (S5): la concurrencia del plan de ElevenLabs es una para toda la
 * plataforma. Cada pasada reparte los huecos libres a partes iguales entre
 * las empresas con cola, y el orden rota cada minuto para que no empiece
 * siempre la misma.
 */
export async function despachar(ahora = new Date()): Promise<ResumenDespacho> {
  const resumen: ResumenDespacho = { lanzadas: 0, fallidas: 0, reconciliadas: 0, lotesCerrados: 0 };
  const supabase = createAdminClient();
  try {
    const { data: empresas, error } = await supabase
      .from("empresas")
      .select("id, guion_activo_id")
      .eq("estado", "activa");
    if (error) throw new Error(`empresas: ${error.message}`);
    const configurado = isConfigured(elevenLabsAgenteEnv);
    // Sin reparto (error al calcularlo) la BD sigue aplicando el límite global.
    const cuota = await cuotaPorEmpresa().catch((e) => {
      log.warn("reparto de concurrencia no disponible", { error: e instanceof Error ? e.message : String(e) });
      return undefined;
    });
    const giro = empresas.length ? Math.floor(ahora.getTime() / 60_000) % empresas.length : 0;
    const enOrden = [...empresas.slice(giro), ...empresas.slice(0, giro)];

    for (const { id, guion_activo_id } of enOrden) {
      try {
        const parada = await despacharEmpresa(id, ahora, configurado, Boolean(guion_activo_id), cuota, resumen);
        if (parada) resumen.paradas = { ...resumen.paradas, [id]: parada };
      } catch (e) {
        log.error("despacho de empresa falló", { empresa_id: id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const { data: cerrados, error: errCerrar } = await supabase.rpc("cerrar_lotes_terminados");
    if (errCerrar) throw new Error(`cerrar_lotes_terminados: ${errCerrar.message}`);
    resumen.lotesCerrados = cerrados ?? 0;

    resumen.purga = await purgarSiToca(ahora);
  } catch (e) {
    log.error("despacho falló", { error: e instanceof Error ? e.message : String(e) });
  }

  // El panel avisa si este latido se queda viejo (la tarea programada no corre).
  const { error: errLatido } = await supabase.from("latidos").upsert({ nombre: "despacho", en: ahora.toISOString() });
  if (errLatido) log.warn("no se pudo registrar el latido", { code: errLatido.code });

  if (resumen.lanzadas || resumen.fallidas || resumen.reconciliadas || resumen.lotesCerrados) {
    log.info("despacho", resumen);
  }
  return resumen;
}

/** La pasada de una empresa. Devuelve por qué no lanzó nada, si es el caso. */
async function despacharEmpresa(
  empresaId: string,
  ahora: Date,
  configurado: boolean,
  conGuion: boolean,
  cuota: number | undefined,
  resumen: ResumenDespacho,
): Promise<MotivoParada | undefined> {
  const supabase = createAdminClient();
  const config = await leerConfiguracion(supabase, empresaId);
  if (configurado) resumen.reconciliadas += await reconciliar(empresaId, config, ahora);

  if (config.pausa_global) return "pausa_global";
  if (!estaEnFranja(ahora, config)) return "fuera_de_franja";
  if (!configurado) return "sin_configurar";
  // Sin guion activo no hay qué decir: los items esperan en cola.
  if (!conGuion) return "sin_guion";
  const linea = await lineaDeEmpresa(empresaId);
  if (!linea) return "sin_linea";

  const { data: reservas, error } = await supabase.rpc("reservar_llamadas_lote", { p_empresa_id: empresaId, p_max: cuota });
  if (error) throw new Error(`reservar_llamadas_lote: ${error.message}`);

  const resultados = await Promise.all(
    reservas.map(async (r) => {
      const res = await iniciarConversacion({
        llamadaId: r.llamada_id,
        contacto: { id: r.contacto_id, nombre: r.nombre, telefono: r.telefono, email: r.email },
        ahora,
        loteId: r.lote_id,
        phoneNumberId: linea.phoneNumberId,
      });
      if (!res.ok) await reprogramarTrasError(r.item_id, res.error, ahora, config);
      return res.ok;
    }),
  );
  const lanzadas = resultados.filter(Boolean).length;
  resumen.lanzadas += lanzadas;
  resumen.fallidas += resultados.length - lanzadas;
  return undefined;
}

/**
 * Huecos que puede ocupar cada empresa en esta pasada: los libres de la
 * plataforma entre las empresas con cola (mínimo 1; la BD vuelve a comprobar
 * el límite global al reservar).
 */
async function cuotaPorEmpresa(): Promise<number> {
  const supabase = createAdminClient();
  const [{ data: global, error: errGlobal }, { data: colas, error: errColas }] = await Promise.all([
    supabase.rpc("concurrencia_global"),
    supabase.rpc("empresas_con_cola"),
  ]);
  if (errGlobal || errColas) throw new Error(`reparto: ${(errGlobal ?? errColas)?.message}`);
  return calcularCuota(global?.[0]?.maximo ?? 0, global?.[0]?.activas ?? 0, colas?.length ?? 0);
}

/** Retención RGPD: borra conversaciones y webhooks antiguos (§13.3). */
async function purgarSiToca(ahora: Date) {
  const supabase = createAdminClient();
  const { data: ultima } = await supabase.from("latidos").select("en").eq("nombre", "purga").maybeSingle();
  if (ultima && ahora.getTime() - new Date(ultima.en).getTime() < CADA_PURGA_MS) return undefined;
  const { data, error } = await supabase.rpc("purgar_datos_antiguos");
  if (error) throw new Error(`purgar_datos_antiguos: ${error.message}`);
  log.info("purga de retención", { resultado: data });
  return data;
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
async function reconciliar(empresaId: string, config: Configuracion, ahora: Date): Promise<number> {
  const supabase = createAdminClient();
  const limite = new Date(ahora.getTime() - config.timeout_llamada_min * 60_000);
  const { data: colgadas, error } = await supabase
    .from("llamadas")
    .select("id, contacto_id, clasificacion, cita_agendada, finalizada_en, lote_id, conversation_id, creado_en")
    .eq("empresa_id", empresaId)
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

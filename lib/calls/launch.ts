import "server-only";
import { after } from "next/server";
import { calcularRango, obtenerDisponibilidad } from "@/lib/calendly/availability";
import { appEnv, calendlyEnv, isConfigured } from "@/lib/env";
import { llamadaSaliente } from "@/lib/elevenlabs/client";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { fechaMadrid, partesMadrid } from "@/lib/time/madrid";
import { leerConfiguracion } from "./config";
import { procesarEventosPendientes } from "./post-call";
import { describirFranjas, estaEnFranja } from "./window";

export type MotivoRechazo =
  | "pausa_global"
  | "no_encontrado"
  | "no_llamar"
  | "sin_consentimiento"
  | "fuera_de_franja"
  | "concurrencia"
  | "llamada_activa"
  | "error_elevenlabs"
  | "error";

export type ResultadoLanzamiento =
  | { ok: true; llamadaId: string; conversationId: string }
  | { ok: false; motivo: MotivoRechazo; mensaje: string; llamadaId?: string };

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "viernes 23 de octubre de 2026, 11:15", para que el agente entienda "mañana". */
export function ahoraEnTexto(fecha: Date): string {
  const p = partesMadrid(fecha);
  const hh = `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
  return `${DIAS[p.diaSemana - 1]} ${p.dia} de ${MESES[p.mes - 1]} de ${p.anio}, ${hh}`;
}

/**
 * Lanza una llamada a un contacto, aplicando en orden las reglas del plan
 * (§8.1): pausa, exclusión, consentimiento, franja, concurrencia y llamada
 * duplicada. Las dos últimas se comprueban en BD de forma atómica.
 */
export async function lanzarLlamada(opciones: {
  contactoId: string;
  lanzadaPor?: string;
  loteId?: string;
  ahora?: Date;
}): Promise<ResultadoLanzamiento> {
  const ahora = opciones.ahora ?? new Date();
  const supabase = createAdminClient();
  const config = await leerConfiguracion(supabase);

  if (config.pausa_global) {
    return { ok: false, motivo: "pausa_global", mensaje: "Las llamadas están en pausa global." };
  }

  const { data: contacto } = await supabase
    .from("contactos")
    .select("id, nombre, telefono, email, estado, consentimiento")
    .eq("id", opciones.contactoId)
    .maybeSingle();
  if (!contacto) return { ok: false, motivo: "no_encontrado", mensaje: "El contacto no existe." };
  if (contacto.estado === "no_llamar") {
    return { ok: false, motivo: "no_llamar", mensaje: "El contacto ha pedido no ser llamado." };
  }
  if (config.tipo_campana === "comercial" && !contacto.consentimiento) {
    return {
      ok: false,
      motivo: "sin_consentimiento",
      mensaje: "Sin consentimiento registrado no se puede hacer una llamada comercial.",
    };
  }
  if (!estaEnFranja(ahora, config)) {
    const festivo = config.festivos.includes(fechaMadrid(ahora));
    return {
      ok: false,
      motivo: "fuera_de_franja",
      mensaje: festivo
        ? "Hoy es festivo: no se hacen llamadas."
        : `Fuera del horario de llamadas (${describirFranjas(config.franjas)}).`,
    };
  }

  const { data: llamadaId, error } = await supabase.rpc("crear_llamada", {
    p_contacto_id: contacto.id,
    p_lote_id: opciones.loteId,
    p_lanzada_por: opciones.lanzadaPor,
  });
  if (error || !llamadaId) {
    const motivo = error?.message;
    if (motivo === "concurrencia") {
      return {
        ok: false,
        motivo,
        mensaje: `Ya hay ${config.max_concurrencia} llamadas en curso, el máximo permitido. Prueba en un momento.`,
      };
    }
    if (motivo === "llamada_activa") return { ok: false, motivo, mensaje: "Este contacto ya tiene una llamada en curso." };
    if (motivo === "pausa_global") return { ok: false, motivo, mensaje: "Las llamadas están en pausa global." };
    if (motivo === "no_llamar") return { ok: false, motivo, mensaje: "El contacto ha pedido no ser llamado." };
    log.error("crear_llamada falló", { code: error?.code, message: error?.message });
    return { ok: false, motivo: "error", mensaje: "No se ha podido registrar la llamada." };
  }

  const r = await iniciarConversacion({ llamadaId, contacto, ahora, loteId: opciones.loteId });
  if (!r.ok) {
    return {
      ok: false,
      motivo: "error_elevenlabs",
      llamadaId,
      mensaje: "El servicio de voz no ha podido iniciar la llamada. Inténtalo de nuevo en unos minutos.",
    };
  }
  return { ok: true, llamadaId, conversationId: r.conversationId };
}

type ContactoLlamada = { id: string; nombre: string; telefono: string; email: string | null };

/**
 * Pide a ElevenLabs la llamada de una fila de `llamadas` ya creada (por
 * crear_llamada o por el dispatcher). Si falla, la deja como fallida.
 */
export async function iniciarConversacion(opciones: {
  llamadaId: string;
  contacto: ContactoLlamada;
  ahora: Date;
  loteId?: string;
}): Promise<{ ok: true; conversationId: string } | { ok: false; error: unknown }> {
  const { llamadaId, contacto, ahora } = opciones;
  const supabase = createAdminClient();

  let conversacion;
  try {
    conversacion = await llamadaSaliente(contacto.telefono, {
      nombre: contacto.nombre,
      llamada_id: llamadaId,
      contacto_id: contacto.id,
      telefono: contacto.telefono,
      email: contacto.email ?? "",
      tiene_email: Boolean(contacto.email),
      negocio: appEnv().NEGOCIO_NOMBRE,
      ahora_madrid: ahoraEnTexto(ahora),
    });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    await supabase
      .from("llamadas")
      .update({ estado: "fallida", motivo_fallo: `api: ${detalle}`.slice(0, 300), finalizada_en: new Date().toISOString() })
      .eq("id", llamadaId);
    return { ok: false, error: e };
  }

  const { error: errUpdate } = await supabase
    .from("llamadas")
    .update({ conversation_id: conversacion.conversationId, sip_call_id: conversacion.sipCallId })
    .eq("id", llamadaId);
  if (errUpdate) log.error("no se pudo guardar conversation_id", { llamada_id: llamadaId, code: errUpdate.code });

  log.info("llamada lanzada", { llamada_id: llamadaId, conversation_id: conversacion.conversationId, lote_id: opciones.loteId });

  after(async () => {
    // Un webhook muy rápido (p. ej. fallo inmediato) pudo llegar antes de
    // guardar conversation_id: se procesa ahora.
    await procesarEventosPendientes(conversacion.conversationId);
    // Pre-calienta la disponibilidad mientras suena y saluda (§10.4).
    if (isConfigured(calendlyEnv)) {
      const rango = calcularRango(undefined, undefined, new Date());
      if (!("error" in rango)) await obtenerDisponibilidad(rango).catch(() => undefined);
    }
  });

  return { ok: true, conversationId: conversacion.conversationId };
}

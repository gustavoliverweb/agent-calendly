import "server-only";
import { z } from "zod";
import { invalidarDisponibilidad } from "@/lib/calendly/availability";
import { reservarEnCalendly } from "@/lib/calendly/booking";
import { CalendlyError } from "@/lib/calendly/client";
import { formatearHueco } from "@/lib/calendly/format-es";
import { isValidEmail } from "@/lib/contacts/parse";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { marcarSeguimiento } from "./llamada";

const texto = z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string());

export const agendarSchema = z.object({
  start_time: texto,
  nombre: texto.optional(),
  email: texto,
  // Llega como variable dinámica; el teléfono fiable es el del contacto en BD.
  telefono: texto.optional(),
  llamada_id: z.uuid(),
});

export type RespuestaAgendar =
  | { ok: true; mensaje: string; start_time: string }
  | {
      ok: false;
      error:
        | "hueco_no_disponible"
        | "email_invalido"
        | "fecha_invalida"
        | "llamada_no_encontrada"
        | "ya_tiene_cita"
        | "no_permitido"
        | "calendario_no_disponible";
      mensaje: string;
    };

const CALENDARIO_NO_DISPONIBLE = {
  ok: false,
  error: "calendario_no_disponible",
  mensaje: "No he podido reservar ahora. Ofrece que le volvamos a llamar para cerrar la cita.",
} as const;

/** El dictado por voz suele dejar espacios ("maria @ gmail . com"). */
export function normalizarEmail(email: string): string {
  return email.replace(/\s+/g, "").toLowerCase();
}

/**
 * Reservas en vuelo por llamada: si ElevenLabs reintenta la tool mientras la
 * primera petición sigue esperando a Calendly, ambas comparten el resultado.
 */
const enVuelo = new Map<string, Promise<RespuestaAgendar>>();

export function agendarCita(params: z.infer<typeof agendarSchema>, ahora = new Date()) {
  const clave = `${params.llamada_id}|${params.start_time}`;
  const existente = enVuelo.get(clave);
  if (existente) return existente;
  const promesa = agendar(params, ahora).finally(() => enVuelo.delete(clave));
  enVuelo.set(clave, promesa);
  return promesa;
}

async function agendar(params: z.infer<typeof agendarSchema>, ahora: Date): Promise<RespuestaAgendar> {
  const inicio = new Date(params.start_time);
  if (Number.isNaN(inicio.getTime()) || !/T.*(Z|[+-]\d{2}:?\d{2})$/.test(params.start_time)) {
    return {
      ok: false,
      error: "fecha_invalida",
      mensaje: "Usa el start_time exacto de uno de los huecos que devolvió la consulta de disponibilidad.",
    };
  }
  if (inicio <= ahora) {
    return {
      ok: false,
      error: "hueco_no_disponible",
      mensaje: "Ese hueco ya ha pasado. Consulta la disponibilidad de nuevo y ofrece otro.",
    };
  }

  const email = normalizarEmail(params.email);
  if (!isValidEmail(email)) {
    return {
      ok: false,
      error: "email_invalido",
      mensaje: "El correo no parece válido. Pídele que lo repita despacio y deletréalo para confirmarlo.",
    };
  }

  const supabase = createAdminClient();
  const { data: llamada, error: errLlamada } = await supabase
    .from("llamadas")
    .select("id, contacto_id, cita_agendada, fecha_cita, contactos (nombre, telefono, estado)")
    .eq("id", params.llamada_id)
    .maybeSingle();
  if (errLlamada) {
    log.error("agendar: no se pudo leer la llamada", { llamada_id: params.llamada_id, code: errLlamada.code });
    return CALENDARIO_NO_DISPONIBLE;
  }
  if (!llamada || !llamada.contactos) {
    log.warn("agendar: llamada no encontrada", { llamada_id: params.llamada_id });
    return {
      ok: false,
      error: "llamada_no_encontrada",
      mensaje: "No he podido identificar esta llamada. Ofrece que le volvamos a llamar para cerrar la cita.",
    };
  }
  const contacto = llamada.contactos;

  // Idempotencia: la misma reserva repetida devuelve la confirmación sin volver a reservar.
  if (llamada.cita_agendada && llamada.fecha_cita) {
    const yaReservada = new Date(llamada.fecha_cita);
    const textoCita = formatearHueco(yaReservada, ahora);
    if (yaReservada.getTime() === inicio.getTime()) {
      return { ok: true, start_time: inicio.toISOString(), mensaje: `La cita ya está confirmada para el ${textoCita}.` };
    }
    return {
      ok: false,
      error: "ya_tiene_cita",
      mensaje: `En esta llamada ya se reservó una cita para el ${textoCita}. Para cambiarla puede usar el enlace del correo de confirmación.`,
    };
  }
  if (contacto.estado === "no_llamar") {
    return {
      ok: false,
      error: "no_permitido",
      mensaje: "Este contacto ha pedido no ser llamado. No reserves; despídete amablemente.",
    };
  }

  let reserva;
  try {
    reserva = await reservarEnCalendly({
      inicio,
      nombre: params.nombre || contacto.nombre,
      email,
      telefono: contacto.telefono,
    });
  } catch (e) {
    if (!(e instanceof CalendlyError)) throw e;
    if (e.tipo === "hueco_no_disponible") {
      invalidarDisponibilidad();
      return {
        ok: false,
        error: "hueco_no_disponible",
        mensaje: "Ese hueco ya no está disponible. Consulta la disponibilidad de nuevo y ofrece otro.",
      };
    }
    await marcarSeguimiento(llamada.id, "fallo_calendly");
    return CALENDARIO_NO_DISPONIBLE;
  }
  invalidarDisponibilidad();

  // La cita ya existe en Calendly: a partir de aquí un fallo de BD no se
  // comunica al contacto. El webhook invitee.created sirve de respaldo.
  await guardarReserva(llamada.id, llamada.contacto_id, inicio, email, reserva);

  return {
    ok: true,
    start_time: inicio.toISOString(),
    mensaje: `Cita confirmada para el ${formatearHueco(inicio, ahora)}. Recibirá un correo de confirmación en ${email}.`,
  };
}

async function guardarReserva(
  llamadaId: string,
  contactoId: string,
  inicio: Date,
  email: string,
  reserva: Awaited<ReturnType<typeof reservarEnCalendly>>,
) {
  const supabase = createAdminClient();

  // Independientes entre sí: en paralelo para no sumar latencias.
  const [cita, llamada, contacto] = await Promise.all([
    // upsert: el webhook puede haber llegado antes y registrado la cita sin llamada.
    supabase.from("citas").upsert(
      {
        contacto_id: contactoId,
        llamada_id: llamadaId,
        calendly_event_uri: reserva.eventUri,
        calendly_invitee_uri: reserva.inviteeUri,
        inicio: inicio.toISOString(),
        estado: "activa",
      },
      { onConflict: "calendly_invitee_uri" },
    ),
    supabase
      .from("llamadas")
      .update({
        cita_agendada: true,
        calendly_event_uri: reserva.eventUri,
        calendly_invitee_uri: reserva.inviteeUri,
        calendly_cancel_url: reserva.cancelUrl,
        calendly_reschedule_url: reserva.rescheduleUrl,
        fecha_cita: inicio.toISOString(),
      })
      .eq("id", llamadaId),
    supabase
      .from("contactos")
      .update({ estado: "cita_agendada", email, requiere_seguimiento: false, seguimiento_motivo: null })
      .eq("id", contactoId)
      .neq("estado", "no_llamar"),
  ]);
  const fallos = [
    cita.error && `citas:${cita.error.code}`,
    llamada.error && `llamadas:${llamada.error.code}`,
    contacto.error && `contactos:${contacto.error.code}`,
  ].filter(Boolean);

  if (fallos.length) {
    log.error("cita reservada en Calendly pero no guardada del todo", {
      llamada_id: llamadaId,
      invitee: reserva.inviteeUri,
      fallos,
    });
  }
}

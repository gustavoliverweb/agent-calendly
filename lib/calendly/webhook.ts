import "server-only";
import { z } from "zod";
import { normalizePhone } from "@/lib/contacts/phone";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidarDisponibilidad } from "./availability";

/** Campos del invitee que usa la app; el resto del payload se ignora. */
export const webhookCalendlySchema = z.object({
  event: z.string(),
  payload: z.object({
    uri: z.string(),
    email: z.string().nullish(),
    text_reminder_number: z.string().nullish(),
    rescheduled: z.boolean().nullish(),
    old_invitee: z.string().nullish(),
    cancel_url: z.string().nullish(),
    reschedule_url: z.string().nullish(),
    cancellation: z.object({ reason: z.string().nullish(), created_at: z.string().nullish() }).nullish(),
    scheduled_event: z.object({
      uri: z.string(),
      start_time: z.string(),
      event_type: z.string().nullish(),
    }),
  }),
});

export type WebhookCalendly = z.infer<typeof webhookCalendlySchema>;

/** Resultado para registrar en eventos_webhook (sin datos personales). */
export type ResultadoWebhook =
  | "ya_registrada"
  | "reprogramada"
  | "registrada_sin_llamada"
  | "sin_contacto"
  | "cancelada"
  | "marcada_reprogramada"
  | "cita_desconocida"
  | "otro_tipo_de_evento"
  | "evento_ignorado";

type Supabase = ReturnType<typeof createAdminClient>;

export async function procesarWebhookCalendly(
  w: WebhookCalendly,
  eventTypeUri: string,
): Promise<ResultadoWebhook> {
  // Otras reuniones del mismo calendario no son cosa de la app.
  const tipo = w.payload.scheduled_event.event_type;
  if (tipo && tipo !== eventTypeUri) return "otro_tipo_de_evento";

  const supabase = createAdminClient();
  let resultado: ResultadoWebhook;
  if (w.event === "invitee.created") resultado = await citaCreada(supabase, w.payload);
  else if (w.event === "invitee.canceled") resultado = await citaCancelada(supabase, w.payload);
  else return "evento_ignorado";

  invalidarDisponibilidad();
  return resultado;
}

/** Lanza si Supabase devuelve error: el webhook responde 500 y Calendly reintenta. */
function comprobar<T extends { error: { code?: string; message: string } | null }>(r: T, paso: string): T {
  if (r.error) throw new Error(`${paso}: ${r.error.code ?? ""} ${r.error.message}`);
  return r;
}

async function citaCreada(supabase: Supabase, p: WebhookCalendly["payload"]): Promise<ResultadoWebhook> {
  const { data: existente } = comprobar(
    await supabase.from("citas").select("id").eq("calendly_invitee_uri", p.uri).maybeSingle(),
    "buscar cita",
  );
  // La reservó el agente (o es un reintento del webhook): nada que hacer.
  if (existente) return "ya_registrada";

  const inicio = new Date(p.scheduled_event.start_time).toISOString();

  // Reprogramación: la cita nueva hereda contacto y llamada de la antigua.
  if (p.old_invitee) {
    const { data: antigua } = comprobar(
      await supabase
        .from("citas")
        .select("id, contacto_id, llamada_id")
        .eq("calendly_invitee_uri", p.old_invitee)
        .maybeSingle(),
      "buscar cita antigua",
    );
    if (antigua) {
      comprobar(
        await supabase.from("citas").upsert(
          {
            contacto_id: antigua.contacto_id,
            llamada_id: antigua.llamada_id,
            calendly_event_uri: p.scheduled_event.uri,
            calendly_invitee_uri: p.uri,
            inicio,
            estado: "activa",
            reprogramada_desde: antigua.id,
          },
          { onConflict: "calendly_invitee_uri", ignoreDuplicates: true },
        ),
        "crear cita reprogramada",
      );
      comprobar(
        await supabase.from("citas").update({ estado: "reprogramada" }).eq("id", antigua.id),
        "marcar antigua",
      );
      if (antigua.llamada_id) {
        comprobar(
          await supabase
            .from("llamadas")
            .update({
              cita_agendada: true,
              fecha_cita: inicio,
              calendly_event_uri: p.scheduled_event.uri,
              calendly_invitee_uri: p.uri,
              calendly_cancel_url: p.cancel_url ?? null,
              calendly_reschedule_url: p.reschedule_url ?? null,
            })
            .eq("id", antigua.llamada_id),
          "actualizar llamada",
        );
      }
      await ponerCitaAgendada(supabase, antigua.contacto_id);
      return "reprogramada";
    }
  }

  // Reserva hecha fuera del agente (o antes de que el agente guardara la
  // suya): se asocia al contacto si se reconoce. No se crean contactos.
  const contactoId = await buscarContacto(supabase, p.email, p.text_reminder_number);
  if (!contactoId) return "sin_contacto";

  comprobar(
    await supabase.from("citas").upsert(
      {
        contacto_id: contactoId,
        calendly_event_uri: p.scheduled_event.uri,
        calendly_invitee_uri: p.uri,
        inicio,
        estado: "activa",
      },
      { onConflict: "calendly_invitee_uri", ignoreDuplicates: true },
    ),
    "crear cita",
  );
  await ponerCitaAgendada(supabase, contactoId);
  return "registrada_sin_llamada";
}

async function citaCancelada(supabase: Supabase, p: WebhookCalendly["payload"]): Promise<ResultadoWebhook> {
  const { data: cita } = comprobar(
    await supabase
      .from("citas")
      .select("id, contacto_id, llamada_id, estado")
      .eq("calendly_invitee_uri", p.uri)
      .maybeSingle(),
    "buscar cita",
  );
  if (!cita) return "cita_desconocida";

  // Reprogramada: la nueva cita llega (o ya llegó) en su invitee.created.
  if (p.rescheduled) {
    comprobar(
      await supabase.from("citas").update({ estado: "reprogramada" }).eq("id", cita.id),
      "marcar reprogramada",
    );
    return "marcada_reprogramada";
  }

  comprobar(
    await supabase
      .from("citas")
      .update({
        estado: "cancelada",
        cancelada_en: p.cancellation?.created_at ?? new Date().toISOString(),
        motivo_cancelacion: p.cancellation?.reason?.slice(0, 500) ?? null,
      })
      .eq("id", cita.id),
    "cancelar cita",
  );
  if (cita.llamada_id) {
    comprobar(
      await supabase
        .from("llamadas")
        .update({ cita_agendada: false })
        .eq("id", cita.llamada_id)
        .eq("calendly_invitee_uri", p.uri),
      "actualizar llamada",
    );
  }

  // Si no le queda otra cita activa, vuelve a "llamado" para que alguien lo retome.
  const { count } = comprobar(
    await supabase
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("contacto_id", cita.contacto_id)
      .eq("estado", "activa"),
    "contar citas",
  );
  if (!count) {
    comprobar(
      await supabase
        .from("contactos")
        .update({ estado: "llamado", requiere_seguimiento: true, seguimiento_motivo: "cita_cancelada" })
        .eq("id", cita.contacto_id)
        .eq("estado", "cita_agendada"),
      "actualizar contacto",
    );
  }
  return "cancelada";
}

async function ponerCitaAgendada(supabase: Supabase, contactoId: string) {
  comprobar(
    await supabase
      .from("contactos")
      .update({ estado: "cita_agendada" })
      .eq("id", contactoId)
      .neq("estado", "no_llamar"),
    "actualizar contacto",
  );
}

async function buscarContacto(
  supabase: Supabase,
  email: string | null | undefined,
  telefono: string | null | undefined,
): Promise<string | null> {
  const tel = telefono ? normalizePhone(telefono) : null;
  if (tel?.ok) {
    const { data } = comprobar(
      await supabase.from("contactos").select("id").eq("telefono", tel.e164).maybeSingle(),
      "buscar por teléfono",
    );
    if (data) return data.id;
  }
  if (email) {
    const { data } = comprobar(
      await supabase.from("contactos").select("id").ilike("email", email.replace(/[\\%_]/g, "\\$&")).limit(2),
      "buscar por email",
    );
    // Varios contactos con el mismo email: ambiguo, mejor no adivinar.
    if (data?.length === 1) return data[0].id;
    if (data && data.length > 1) log.warn("webhook calendly: email ambiguo", { email });
  }
  return null;
}

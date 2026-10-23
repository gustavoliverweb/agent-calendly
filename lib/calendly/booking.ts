import "server-only";
import { calendlyEnv } from "@/lib/env";
import { TZ } from "@/lib/time/madrid";
import { calendlyFetch } from "./client";

export type Reserva = {
  inviteeUri: string;
  eventUri: string;
  cancelUrl: string | null;
  rescheduleUrl: string | null;
};

type InviteeResponse = {
  resource: { uri: string; event: string; cancel_url?: string; reschedule_url?: string };
};

/**
 * Ubicación para el invitee según CALENDLY_LOCATION_KIND. Debe coincidir con
 * la del tipo de evento; sin variable, no se envía (Calendly usa la única
 * configurada).
 */
function ubicacion(telefono: string) {
  const { CALENDLY_LOCATION_KIND: kind, CALENDLY_LOCATION: location } = calendlyEnv();
  if (!kind) return undefined;
  // En "outbound_call" el anfitrión llama al invitee: va su teléfono.
  if (kind === "outbound_call") return { kind, location: telefono };
  return location ? { kind, location } : { kind };
}

/** Crea la reserva en Calendly (Scheduling API, plan de pago). Sin caché ni reintentos. */
export async function reservarEnCalendly(datos: {
  inicio: Date;
  nombre: string;
  email: string;
  telefono: string;
}): Promise<Reserva> {
  const location = ubicacion(datos.telefono);
  const { resource } = await calendlyFetch<InviteeResponse>("/invitees", {
    method: "POST",
    body: {
      event_type: calendlyEnv().CALENDLY_EVENT_TYPE_URI,
      start_time: datos.inicio.toISOString(),
      invitee: { name: datos.nombre, email: datos.email, timezone: TZ },
      ...(location ? { location } : {}),
    },
    // Más margen que en disponibilidad: cortar una reserva que Calendly sí
    // completa dejaría una cita que el agente cree fallida.
    timeoutMs: 4000,
  });
  return {
    inviteeUri: resource.uri,
    eventUri: resource.event,
    cancelUrl: resource.cancel_url ?? null,
    rescheduleUrl: resource.reschedule_url ?? null,
  };
}

import "server-only";
import { TZ } from "@/lib/time/madrid";
import { calendlyFetch } from "./client";
import type { ConexionCalendly } from "./conexion";

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
 * Ubicación para el invitee (la del tipo de evento de la empresa). Debe
 * coincidir con la del tipo de evento: sin ella Calendly rechaza la reserva
 * (`invalid_location_choice`), aunque el tipo tenga una sola ubicación.
 */
function ubicacion(conexion: ConexionCalendly, telefono: string) {
  const { ubicacionKind: kind, ubicacion: location } = conexion;
  if (!kind) return undefined;
  // En "outbound_call" el anfitrión llama al invitee: va su teléfono.
  if (kind === "outbound_call") return { kind, location: telefono };
  return location ? { kind, location } : { kind };
}

/** Crea la reserva en Calendly (Scheduling API, plan de pago). Sin caché ni reintentos. */
export async function reservarEnCalendly(conexion: ConexionCalendly, datos: {
  inicio: Date;
  nombre: string;
  email: string;
  telefono: string;
}): Promise<Reserva> {
  const location = ubicacion(conexion, datos.telefono);
  const { resource } = await calendlyFetch<InviteeResponse>(conexion.token, "/invitees", {
    method: "POST",
    body: {
      event_type: conexion.eventTypeUri,
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

/** Nombres en castellano de las ubicaciones de Calendly (sin dependencias de servidor). */

const ETIQUETAS_UBICACION: Record<string, string> = {
  physical: "En persona",
  google_conference: "Google Meet",
  zoom_conference: "Zoom",
  microsoft_teams_conference: "Microsoft Teams",
  webex_conference: "Webex",
  gotomeeting_conference: "GoTo Meeting",
  outbound_call: "Llamada del anfitrión al invitado",
  inbound_call: "Llamada del invitado al anfitrión",
  ask_invitee: "La elige el invitado",
  custom: "Otra",
};

export function etiquetaUbicacion(kind: string | null): string {
  if (!kind) return "Sin ubicación";
  return ETIQUETAS_UBICACION[kind] ?? kind;
}

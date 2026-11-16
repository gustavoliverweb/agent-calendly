import "server-only";
import { appEnv, calendlyOAuthEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { claveDesdeBase64, descifrar } from "@/lib/security/cifrado";
import { createAdminClient } from "@/lib/supabase/admin";
import { CalendlyError, calendlyFetch } from "./client";
import { renovar } from "./conexion";

/**
 * Gestión de la cuenta de Calendly conectada por una empresa: datos de la
 * cuenta, tipos de evento y webhook. Lo usan la sección Calendly del panel y
 * el callback de OAuth.
 */

export const EVENTOS_WEBHOOK = ["invitee.created", "invitee.canceled"] as const;

export function urlWebhookEmpresa(empresaId: string) {
  return new URL(`/api/webhooks/calendly/${empresaId}`, appEnv().APP_URL).toString();
}

/** Token para gestionar la cuenta (también sin tipo de evento elegido). Null si no está conectada. */
export async function tokenGestion(empresaId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("integraciones_calendly")
    .select("estado, access_token, token_expira_en")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!data || data.estado === "desconectada" || !data.access_token) return null;
  const caduca = data.token_expira_en ? new Date(data.token_expira_en).getTime() : 0;
  if (caduca - Date.now() > 5 * 60_000) return descifrar(data.access_token, claveDesdeBase64(calendlyOAuthEnv().ENCRYPTION_KEY));
  return renovar(empresaId);
}

export type UsuarioCalendly = { uri: string; nombre: string; email: string; organizacionUri: string };

export async function usuarioActual(token: string): Promise<UsuarioCalendly> {
  const { resource } = await calendlyFetch<{
    resource: { uri: string; name: string; email: string; current_organization: string };
  }>(token, "/users/me", { timeoutMs: 8000 });
  return { uri: resource.uri, nombre: resource.name, email: resource.email, organizacionUri: resource.current_organization };
}

export type UbicacionTipo = { kind: string; location?: string | null };

export type TipoEvento = {
  uri: string;
  nombre: string;
  duracion: number | null;
  ubicaciones: UbicacionTipo[];
  url: string | null;
};

type EventTypeApi = {
  uri: string;
  name: string;
  active: boolean;
  duration?: number | null;
  scheduling_url?: string | null;
  locations?: { kind: string; location?: string | null }[] | null;
};

function aTipo(e: EventTypeApi): TipoEvento {
  return {
    uri: e.uri,
    nombre: e.name,
    duracion: e.duration ?? null,
    ubicaciones: (e.locations ?? []).map((l) => ({ kind: l.kind, location: l.location ?? null })),
    url: e.scheduling_url ?? null,
  };
}

/** Tipos de evento activos del usuario conectado. */
export async function tiposDeEvento(token: string, usuarioUri: string): Promise<TipoEvento[]> {
  const r = await calendlyFetch<{ collection: EventTypeApi[] }>(token, "/event_types", {
    query: { user: usuarioUri, active: "true", count: "100", sort: "name:asc" },
    timeoutMs: 8000,
  });
  return r.collection.filter((e) => e.active).map(aTipo);
}

/**
 * Ubicación que se envía al reservar: la primera del tipo de evento. Sin
 * ubicaciones, ninguna. "outbound_call" lleva el teléfono del contacto, que
 * se pone al reservar.
 */
export function ubicacionParaReservar(tipo: TipoEvento): { kind: string | null; location: string | null } {
  const u = tipo.ubicaciones[0];
  if (!u) return { kind: null, location: null };
  return { kind: u.kind, location: u.kind === "outbound_call" ? null : (u.location ?? null) };
}

/** Crea (o reutiliza, si ya existe con la misma URL) el webhook de la empresa con alcance de usuario. */
export async function crearWebhook(
  token: string,
  datos: { empresaId: string; usuarioUri: string; organizacionUri: string },
): Promise<string> {
  const url = urlWebhookEmpresa(datos.empresaId);
  try {
    const { resource } = await calendlyFetch<{ resource: { uri: string } }>(token, "/webhook_subscriptions", {
      method: "POST",
      body: {
        url,
        events: EVENTOS_WEBHOOK,
        organization: datos.organizacionUri,
        user: datos.usuarioUri,
        scope: "user",
      },
      timeoutMs: 8000,
    });
    return resource.uri;
  } catch (e) {
    // 409: ya hay una suscripción con esa URL (p. ej. tras reconectar).
    if (!(e instanceof CalendlyError) || e.status !== 409) throw e;
    const existente = await buscarWebhook(token, datos.organizacionUri, datos.usuarioUri, url);
    if (!existente) throw e;
    return existente;
  }
}

async function buscarWebhook(token: string, organizacion: string, usuario: string, url: string) {
  const r = await calendlyFetch<{ collection: { uri: string; callback_url: string }[] }>(token, "/webhook_subscriptions", {
    query: { organization: organizacion, user: usuario, scope: "user", count: "100" },
    timeoutMs: 8000,
  });
  return r.collection.find((w) => w.callback_url === url)?.uri ?? null;
}

/** Borra el webhook. Si ya no existe, se da por borrado. */
export async function borrarWebhook(token: string, uri: string) {
  try {
    await calendlyFetch<void>(token, uri, { method: "DELETE", timeoutMs: 8000 });
  } catch (e) {
    if (e instanceof CalendlyError && e.status === 404) return;
    log.warn("calendly: no se pudo borrar el webhook", { error: e instanceof Error ? e.message : String(e) });
  }
}

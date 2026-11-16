import "server-only";
import { z } from "zod";
import { log } from "@/lib/log";
import { claveDesdeBase64, descifrar } from "@/lib/security/cifrado";
import { createAdminClient } from "@/lib/supabase/admin";
import { calendlyOAuthEnv } from "@/lib/env";
import { invalidarDisponibilidad } from "./availability";
import { CalendlyError } from "./client";
import { filaTokens, olvidarConexionCalendly } from "./conexion";
import {
  borrarWebhook,
  crearWebhook,
  tiposDeEvento,
  tokenGestion,
  ubicacionParaReservar,
  usuarioActual,
} from "./cuenta";
import { canjearCodigo, OAuthCalendlyError, revocarToken } from "./oauth";

/**
 * Conectar, configurar y desconectar el Calendly de una empresa (S4). Todo va
 * con service role: quien llama ya comprobó que el usuario es propietario.
 */

export const COOKIE_OAUTH = "calendly_oauth";

/** Lo que viaja en la cookie entre "Conectar" y la vuelta de Calendly. */
export type EstadoOAuth = { v: string; s: string; e: string };

const estadoSchema = z.object({ v: z.string().min(43).max(128), s: z.string().min(16).max(64), e: z.uuid() });

export function leerEstadoOAuth(cookie: string | undefined): EstadoOAuth | null {
  if (!cookie) return null;
  try {
    const r = estadoSchema.safeParse(JSON.parse(Buffer.from(cookie, "base64url").toString("utf8")));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export type ErrorConexion =
  | "denegado"
  | "caducado"
  | "solo_propietario"
  | "cuenta_en_otra_empresa"
  | "calendly"
  | "error";

const UNIQUE_VIOLATION = "23505";

/**
 * Vuelta de OAuth: canjea el código, lee la cuenta y guarda los tokens
 * cifrados. Si es la misma cuenta que ya tenía y con tipo de evento elegido,
 * queda conectada al momento; si no, falta elegir el tipo de evento.
 */
export async function completarConexion(datos: {
  usuarioId: string;
  estado: EstadoOAuth | null;
  code: string | null;
  state: string | null;
  error: string | null;
}): Promise<{ ok: true } | { error: ErrorConexion }> {
  if (datos.error) return { error: "denegado" };
  // Sin cookie (más de 10 minutos, otro navegador) o state distinto: se empieza de nuevo.
  if (!datos.estado || !datos.code || (datos.state && datos.state !== datos.estado.s)) return { error: "caducado" };
  const empresaId = datos.estado.e;

  const supabase = createAdminClient();
  const { data: miembro } = await supabase
    .from("miembros")
    .select("rol")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", datos.usuarioId)
    .maybeSingle();
  if (miembro?.rol !== "propietario") return { error: "solo_propietario" };

  let tokens;
  let cuenta;
  try {
    tokens = await canjearCodigo(datos.code, datos.estado.v);
    cuenta = await usuarioActual(tokens.accessToken);
  } catch (e) {
    log.error("calendly: no se pudo completar la conexión", {
      empresa_id: empresaId,
      error: e instanceof Error ? e.message : String(e),
      status: e instanceof OAuthCalendlyError || e instanceof CalendlyError ? e.status : undefined,
    });
    return { error: "calendly" };
  }

  const { data: previa } = await supabase
    .from("integraciones_calendly")
    .select("usuario_uri, event_type_uri, event_type_nombre, ubicacion_kind, ubicacion, webhook_uri")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const mismaCuenta = previa?.usuario_uri === cuenta.uri && Boolean(previa?.event_type_uri);

  // Otra cuenta: el webhook de la anterior apuntaría a esta empresa. Se
  // intenta borrar con sus tokens (si aún valen).
  if (previa?.webhook_uri && previa.usuario_uri !== cuenta.uri) {
    const tokenAnterior = await tokenGestion(empresaId).catch(() => null);
    if (tokenAnterior) await borrarWebhook(tokenAnterior, previa.webhook_uri);
  }

  let webhookUri: string | null = mismaCuenta ? (previa?.webhook_uri ?? null) : null;
  if (mismaCuenta) {
    // Reconexión: el webhook pudo borrarse al revocar; se asegura que exista.
    webhookUri = await crearWebhook(tokens.accessToken, {
      empresaId,
      usuarioUri: cuenta.uri,
      organizacionUri: cuenta.organizacionUri,
    }).catch((e) => {
      log.warn("calendly: webhook al reconectar", { empresa_id: empresaId, error: e instanceof Error ? e.message : String(e) });
      return previa?.webhook_uri ?? null;
    });
  }

  const fila = {
    empresa_id: empresaId,
    estado: mismaCuenta ? "conectada" : "pendiente",
    ...filaTokens(tokens),
    renovando_hasta: null,
    usuario_uri: cuenta.uri,
    organizacion_uri: cuenta.organizacionUri,
    cuenta_nombre: cuenta.nombre,
    cuenta_email: cuenta.email,
    event_type_uri: mismaCuenta ? previa!.event_type_uri : null,
    event_type_nombre: mismaCuenta ? previa!.event_type_nombre : null,
    ubicacion_kind: mismaCuenta ? previa!.ubicacion_kind : null,
    ubicacion: mismaCuenta ? previa!.ubicacion : null,
    webhook_uri: webhookUri,
    ultimo_error: null,
    ultimo_error_en: null,
    conectado_por: datos.usuarioId,
    conectado_en: new Date().toISOString(),
  };
  const { error } = await supabase.from("integraciones_calendly").upsert(fila, { onConflict: "empresa_id" });
  if (error) {
    await revocarToken(tokens.refreshToken);
    if (error.code === UNIQUE_VIOLATION) return { error: "cuenta_en_otra_empresa" };
    log.error("calendly: guardar integración", { empresa_id: empresaId, code: error.code, message: error.message });
    return { error: "error" };
  }

  await supabase.from("auditoria").insert({
    usuario: datos.usuarioId,
    empresa_id: empresaId,
    accion: "conectar_calendly",
    entidad: "integracion_calendly",
    detalle: { reconexion: mismaCuenta },
  });
  olvidarConexionCalendly(empresaId);
  log.info("calendly conectado", { empresa_id: empresaId, reconexion: mismaCuenta });
  return { ok: true };
}

/**
 * Elige el tipo de evento con el que el agente reserva, guarda su ubicación y
 * crea el webhook de la empresa. A partir de aquí la empresa queda conectada.
 */
export async function elegirTipoEvento(
  empresaId: string,
  usuarioId: string,
  eventTypeUri: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createAdminClient();
  const { data: fila } = await supabase
    .from("integraciones_calendly")
    .select("estado, usuario_uri, organizacion_uri, webhook_uri")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!fila || fila.estado === "desconectada" || !fila.usuario_uri || !fila.organizacion_uri) {
    return { error: "Conecta antes tu cuenta de Calendly." };
  }

  try {
    const token = await tokenGestion(empresaId);
    if (!token) return { error: "Conecta antes tu cuenta de Calendly." };
    // Solo un tipo de evento activo de la cuenta conectada (no una URI cualquiera).
    const tipo = (await tiposDeEvento(token, fila.usuario_uri)).find((t) => t.uri === eventTypeUri);
    if (!tipo) return { error: "Ese tipo de evento no está entre los activos de tu cuenta de Calendly." };
    const webhookUri =
      fila.webhook_uri ??
      (await crearWebhook(token, { empresaId, usuarioUri: fila.usuario_uri, organizacionUri: fila.organizacion_uri }));
    const ubicacion = ubicacionParaReservar(tipo);

    const { error } = await supabase
      .from("integraciones_calendly")
      .update({
        estado: "conectada",
        event_type_uri: tipo.uri,
        event_type_nombre: tipo.nombre,
        ubicacion_kind: ubicacion.kind,
        ubicacion: ubicacion.location,
        webhook_uri: webhookUri,
        ultimo_error: null,
        ultimo_error_en: null,
      })
      .eq("empresa_id", empresaId);
    if (error) throw new Error(error.message);

    await supabase.from("auditoria").insert({
      usuario: usuarioId,
      empresa_id: empresaId,
      accion: "elegir_tipo_evento_calendly",
      entidad: "integracion_calendly",
      detalle: { tipo: tipo.nombre },
    });
  } catch (e) {
    log.error("calendly: elegir tipo de evento", { empresa_id: empresaId, error: e instanceof Error ? e.message : String(e) });
    if (e instanceof CalendlyError && e.tipo === "auth") {
      return { error: "Calendly ha rechazado la petición: vuelve a conectar la cuenta." };
    }
    return { error: "No se ha podido guardar el tipo de evento. Inténtalo de nuevo." };
  }

  olvidarConexionCalendly(empresaId);
  invalidarDisponibilidad();
  return { ok: true };
}

/** Borra el webhook, revoca la autorización y olvida la cuenta. */
export async function desconectarCalendly(empresaId: string, usuarioId: string) {
  const supabase = createAdminClient();
  const { data: fila } = await supabase
    .from("integraciones_calendly")
    .select("estado, webhook_uri")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!fila) return;

  if (fila.estado !== "desconectada") {
    const token = await tokenGestion(empresaId).catch(() => null);
    if (token && fila.webhook_uri) await borrarWebhook(token, fila.webhook_uri);
    const { data: actual } = await supabase
      .from("integraciones_calendly")
      .select("refresh_token")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (actual?.refresh_token) {
      await revocarToken(descifrar(actual.refresh_token, claveDesdeBase64(calendlyOAuthEnv().ENCRYPTION_KEY)));
    }
  }

  const { error } = await supabase.from("integraciones_calendly").delete().eq("empresa_id", empresaId);
  if (error) throw new Error(`desconectar calendly: ${error.message}`);
  await supabase.from("auditoria").insert({
    usuario: usuarioId,
    empresa_id: empresaId,
    accion: "desconectar_calendly",
    entidad: "integracion_calendly",
  });
  olvidarConexionCalendly(empresaId);
  invalidarDisponibilidad();
  log.info("calendly desconectado a petición", { empresa_id: empresaId });
}

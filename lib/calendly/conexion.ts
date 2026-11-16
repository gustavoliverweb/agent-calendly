import "server-only";
import { empresaPrincipalId } from "@/lib/empresa";
import { calendlyEnv, calendlyOAuthEnv, isConfigured } from "@/lib/env";
import { log } from "@/lib/log";
import { cifrar, claveDesdeBase64, descifrar } from "@/lib/security/cifrado";
import { createAdminClient } from "@/lib/supabase/admin";
import { CalendlyError } from "./client";
import { OAuthCalendlyError, refrescarToken, type TokensCalendly } from "./oauth";

/**
 * Calendly de una empresa, listo para consultar huecos y reservar.
 *
 * - "oauth": la cuenta que la empresa conectó desde el panel (S4).
 * - "entorno": transitorio. La empresa principal sigue usando el Calendly de
 *   las variables de entorno hasta que conecte el suyo por OAuth.
 */
export type ConexionCalendly = {
  empresaId: string;
  origen: "oauth" | "entorno";
  token: string;
  eventTypeUri: string;
  ubicacionKind: string | null;
  ubicacion: string | null;
};

/** Se renueva si le quedan menos de 5 minutos. */
const MARGEN_RENOVACION_MS = 5 * 60_000;
/** Caché en memoria: las tools tienen ~1,5 s y no deben ir siempre a la BD. */
const CACHE_MS = 30_000;
/** Si otro proceso está renovando, cuánto se espera a que termine. */
const ESPERA_RENOVACION_MS = 4000;

const cache = new Map<string, { expira: number; valor: ConexionCalendly | null }>();
const renovando = new Map<string, Promise<string>>();

export function olvidarConexionCalendly(empresaId?: string) {
  if (empresaId) cache.delete(empresaId);
  else cache.clear();
}

function clave() {
  return claveDesdeBase64(calendlyOAuthEnv().ENCRYPTION_KEY);
}

export function cifrarToken(token: string) {
  return cifrar(token, clave());
}

/** Datos de los tokens para guardar en integraciones_calendly. */
export function filaTokens(t: TokensCalendly) {
  return {
    access_token: cifrarToken(t.accessToken),
    refresh_token: cifrarToken(t.refreshToken),
    token_expira_en: t.expiraEn.toISOString(),
  };
}

/** Calendly de la empresa, o null si no tiene ninguno listo (sin conectar, sin tipo de evento o desconectado). */
export async function conexionCalendly(empresaId: string): Promise<ConexionCalendly | null> {
  const ahora = Date.now();
  const enCache = cache.get(empresaId);
  if (enCache && enCache.expira > ahora) return enCache.valor;

  const { data: fila, error } = await createAdminClient()
    .from("integraciones_calendly")
    .select("estado, access_token, token_expira_en, event_type_uri, ubicacion_kind, ubicacion")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error) {
    log.error("calendly: leer integración", { empresa_id: empresaId, code: error.code });
    throw new CalendlyError("temporal", "No se pudo leer la integración de Calendly");
  }

  let valor: ConexionCalendly | null = null;
  let expira = ahora + CACHE_MS;

  if (fila?.estado === "conectada" && fila.event_type_uri && fila.access_token && isConfigured(calendlyOAuthEnv)) {
    const caduca = fila.token_expira_en ? new Date(fila.token_expira_en).getTime() : 0;
    const token = caduca - ahora > MARGEN_RENOVACION_MS ? descifrar(fila.access_token, clave()) : await renovar(empresaId);
    valor = {
      empresaId,
      origen: "oauth",
      token,
      eventTypeUri: fila.event_type_uri,
      ubicacionKind: fila.ubicacion_kind,
      ubicacion: fila.ubicacion,
    };
    if (caduca - ahora > MARGEN_RENOVACION_MS) expira = Math.min(expira, caduca - MARGEN_RENOVACION_MS);
  } else if (isConfigured(calendlyEnv) && empresaId === (await empresaPrincipalId())) {
    const env = calendlyEnv();
    valor = {
      empresaId,
      origen: "entorno",
      token: env.CALENDLY_TOKEN,
      eventTypeUri: env.CALENDLY_EVENT_TYPE_URI,
      ubicacionKind: env.CALENDLY_LOCATION_KIND ?? null,
      ubicacion: env.CALENDLY_LOCATION ?? null,
    };
  }

  cache.set(empresaId, { expira, valor });
  return valor;
}

/**
 * Access token nuevo. El refresh token es de un solo uso: la BD da un turno
 * por empresa (reclamar_renovacion_calendly) y en este proceso se comparte la
 * promesa, así que solo una petición lo gasta.
 */
export function renovar(empresaId: string): Promise<string> {
  const enCurso = renovando.get(empresaId);
  if (enCurso) return enCurso;
  const promesa = renovarConTurno(empresaId).finally(() => renovando.delete(empresaId));
  renovando.set(empresaId, promesa);
  return promesa;
}

async function renovarConTurno(empresaId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data: turno, error: errTurno } = await supabase.rpc("reclamar_renovacion_calendly", { p_empresa_id: empresaId });
  if (errTurno) throw new CalendlyError("temporal", `Turno de renovación: ${errTurno.message}`);

  if (!turno) {
    // Otro proceso la está renovando: esperar a que guarde el token nuevo.
    const limite = Date.now() + ESPERA_RENOVACION_MS;
    while (Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 300));
      const { data } = await supabase
        .from("integraciones_calendly")
        .select("access_token, token_expira_en, estado")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (!data || data.estado === "desconectada") throw new CalendlyError("auth", "Calendly desconectado");
      const caduca = data.token_expira_en ? new Date(data.token_expira_en).getTime() : 0;
      if (data.access_token && caduca - Date.now() > MARGEN_RENOVACION_MS) return descifrar(data.access_token, clave());
    }
    throw new CalendlyError("temporal", "La renovación del token de Calendly tarda demasiado");
  }

  const { data: fila } = await supabase
    .from("integraciones_calendly")
    .select("refresh_token")
    .eq("empresa_id", empresaId)
    .single();
  if (!fila?.refresh_token) throw new CalendlyError("auth", "Calendly sin refresh token");

  let tokens: TokensCalendly;
  try {
    tokens = await refrescarToken(descifrar(fila.refresh_token, clave()));
  } catch (e) {
    if (e instanceof OAuthCalendlyError && e.invalidGrant) {
      await marcarDesconectada(empresaId, "refresh_invalido");
      throw new CalendlyError("auth", "La autorización de Calendly ya no es válida");
    }
    await supabase.from("integraciones_calendly").update({ renovando_hasta: null }).eq("empresa_id", empresaId);
    throw new CalendlyError("temporal", e instanceof Error ? e.message : String(e));
  }

  const { error } = await supabase
    .from("integraciones_calendly")
    .update({ ...filaTokens(tokens), renovando_hasta: null, ultimo_error: null, ultimo_error_en: null })
    .eq("empresa_id", empresaId);
  if (error) {
    // El refresh token anterior ya no vale y el nuevo no se ha guardado: la
    // empresa tendrá que reconectar en cuanto caduque este access token.
    log.error("calendly: token renovado sin guardar", { empresa_id: empresaId, code: error.code });
  } else {
    log.info("calendly: token renovado", { empresa_id: empresaId });
  }
  cache.delete(empresaId);
  return tokens.accessToken;
}

/** La autorización dejó de valer: el panel pide reconectar y las tools responden "le llamaremos". */
export async function marcarDesconectada(empresaId: string, motivo: string) {
  const { error } = await createAdminClient()
    .from("integraciones_calendly")
    .update({
      estado: "desconectada",
      access_token: null,
      refresh_token: null,
      token_expira_en: null,
      renovando_hasta: null,
      ultimo_error: motivo,
      ultimo_error_en: new Date().toISOString(),
    })
    .eq("empresa_id", empresaId);
  if (error) log.error("calendly: no se pudo marcar desconectada", { empresa_id: empresaId, code: error.code });
  else log.warn("calendly desconectado", { empresa_id: empresaId, motivo });
  cache.delete(empresaId);
}

/** Problema que el panel debe enseñar (p. ej. plan sin Scheduling API). Solo para conexiones OAuth. */
export async function registrarErrorCalendly(conexion: ConexionCalendly, error: string) {
  if (conexion.origen !== "oauth") return;
  await createAdminClient()
    .from("integraciones_calendly")
    .update({ ultimo_error: error, ultimo_error_en: new Date().toISOString() })
    .eq("empresa_id", conexion.empresaId);
}

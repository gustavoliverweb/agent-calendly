import "server-only";
import { elevenLabsAgenteEnv } from "@/lib/env";
import { log } from "@/lib/log";

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

async function elevenFetch<T>(ruta: string, init: { method?: string; body?: unknown; timeoutMs: number }): Promise<T> {
  const env = elevenLabsAgenteEnv();
  const url = new URL(ruta, env.ELEVENLABS_API_BASE);
  const inicio = performance.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === "TimeoutError";
    log.error("elevenlabs sin respuesta", { ruta: url.pathname, timeout });
    throw new ElevenLabsError(timeout ? "ElevenLabs no respondió a tiempo" : "Error de red con ElevenLabs");
  }
  const ms = Math.round(performance.now() - inicio);
  if (!res.ok) {
    const texto = (await res.text().catch(() => "")).slice(0, 500);
    log.error("elevenlabs error", { ruta: url.pathname, status: res.status, ms, cuerpo: texto });
    throw new ElevenLabsError(`ElevenLabs respondió ${res.status}`, res.status);
  }
  log.info("elevenlabs ok", { ruta: url.pathname, status: res.status, ms });
  const texto = await res.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

export type VariablesDinamicas = Record<string, string | number | boolean>;

/**
 * Lo que cambia por llamada fuera de las variables. Solo la voz: el primer
 * mensaje viaja como variable ({{primer_mensaje}}), así no hace falta activar
 * su override. Para cambiar la voz hay que activar la override de voz en la
 * pestaña Security del agente; si no, ElevenLabs rechaza la conversación.
 */
export type OverridesLlamada = { vozId?: string | null };

type OutboundResponse = {
  success: boolean;
  message: string;
  conversation_id: string | null;
  sip_call_id: string | null;
};

/**
 * Lanza una llamada saliente por la línea SIP de la empresa (`phoneNumberId`,
 * el número importado en ElevenLabs). Sin reintentos: si la red falla después
 * de que ElevenLabs aceptara la petición, reintentar podría llamar dos veces
 * a la misma persona.
 */
export async function llamadaSaliente(
  phoneNumberId: string,
  telefono: string,
  variables: VariablesDinamicas,
  overrides: OverridesLlamada = {},
) {
  const env = elevenLabsAgenteEnv();
  const r = await elevenFetch<OutboundResponse>("/v1/convai/sip-trunk/outbound-call", {
    method: "POST",
    body: {
      agent_id: env.ELEVENLABS_AGENT_ID,
      agent_phone_number_id: phoneNumberId,
      to_number: telefono,
      conversation_initiation_client_data: {
        dynamic_variables: variables,
        ...(overrides.vozId ? { conversation_config_override: { tts: { voice_id: overrides.vozId } } } : {}),
      },
    },
    timeoutMs: 10_000,
  });
  if (!r.success || !r.conversation_id) {
    throw new ElevenLabsError(r.message || "ElevenLabs no inició la llamada");
  }
  return { conversationId: r.conversation_id, sipCallId: r.sip_call_id };
}

/**
 * URL firmada para una conversación de prueba desde el navegador (WebSocket).
 * Caduca a los 15 minutos y sirve para una sola conversación; así la clave de
 * la API nunca llega al cliente.
 */
export async function urlFirmadaConversacion(): Promise<string> {
  const env = elevenLabsAgenteEnv();
  const r = await elevenFetch<{ signed_url: string }>(
    `/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(env.ELEVENLABS_AGENT_ID)}`,
    { timeoutMs: 8000 },
  );
  if (!r?.signed_url) throw new ElevenLabsError("ElevenLabs no devolvió la URL firmada");
  return r.signed_url;
}

export type NumeroElevenLabs = {
  phoneNumberId: string;
  numero: string;
  etiqueta: string | null;
  proveedor: string | null;
};

type NumeroApi = { phone_number_id: string; phone_number: string; label?: string | null; provider?: string | null };

/** Números importados en la cuenta de ElevenLabs del proveedor (para asignarlos a empresas en /admin). */
export async function listarNumeros(): Promise<NumeroElevenLabs[]> {
  const r = await elevenFetch<NumeroApi[] | { phone_numbers?: NumeroApi[] }>("/v1/convai/phone-numbers", { timeoutMs: 8000 });
  const lista = Array.isArray(r) ? r : (r?.phone_numbers ?? []);
  return lista.map((n) => ({
    phoneNumberId: n.phone_number_id,
    numero: n.phone_number,
    etiqueta: n.label ?? null,
    proveedor: n.provider ?? null,
  }));
}

export type Conversacion = {
  conversation_id: string;
  status: "initiated" | "in-progress" | "processing" | "done" | "failed";
  transcript: unknown[];
  metadata: {
    call_duration_secs?: number;
    termination_reason?: string | null;
    phone_call?: { call_result?: string | null } | null;
  };
  analysis?: unknown;
};

/** Estado de una conversación (reconciliación de llamadas sin webhook). */
export function obtenerConversacion(conversationId: string) {
  return elevenFetch<Conversacion>(`/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
    timeoutMs: 8000,
  });
}

/**
 * Borra una conversación (transcripción y audio) en ElevenLabs: derecho de
 * supresión. Si ya no existe, se da por borrada.
 */
export async function borrarConversacion(conversationId: string) {
  try {
    await elevenFetch<unknown>(`/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
      method: "DELETE",
      timeoutMs: 8000,
    });
  } catch (e) {
    if (e instanceof ElevenLabsError && e.status === 404) return;
    throw e;
  }
}

// --- Voces (catálogo de /admin/voces) ----------------------------------------

export type VozElevenLabs = {
  voiceId: string;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  etiquetas: Record<string, string>;
  /** Idiomas verificados (p. ej. "es (castellano)"). */
  idiomas: string[];
  muestraUrl: string | null;
};

type VozApi = {
  voice_id: string;
  name?: string | null;
  category?: string | null;
  description?: string | null;
  labels?: Record<string, string> | null;
  preview_url?: string | null;
  verified_languages?: { language: string; accent?: string | null; preview_url?: string | null }[] | null;
};

/** Muestra en castellano si la voz la tiene; si no, la general. */
function muestraDe(v: VozApi): string | null {
  const es = v.verified_languages?.find((l) => l.language === "es" && l.preview_url);
  return es?.preview_url ?? v.preview_url ?? null;
}

function aVoz(v: VozApi): VozElevenLabs {
  return {
    voiceId: v.voice_id,
    nombre: v.name ?? v.voice_id,
    categoria: v.category ?? null,
    descripcion: v.description ?? null,
    etiquetas: v.labels ?? {},
    idiomas: [...new Set((v.verified_languages ?? []).map((l) => (l.accent ? `${l.language} (${l.accent})` : l.language)))],
    muestraUrl: muestraDe(v),
  };
}

/** Voces de la cuenta del proveedor (las suyas y las guardadas de la biblioteca), de 100 en 100. */
export async function buscarVoces(busqueda: string, pagina?: string): Promise<{ voces: VozElevenLabs[]; siguiente: string | null }> {
  const params = new URLSearchParams({ page_size: "100", sort: "name", sort_direction: "asc", include_total_count: "false" });
  if (busqueda.trim()) params.set("search", busqueda.trim().slice(0, 100));
  if (pagina) params.set("next_page_token", pagina);
  const r = await elevenFetch<{ voices?: VozApi[]; has_more?: boolean; next_page_token?: string | null }>(
    `/v2/voices?${params}`,
    { timeoutMs: 8000 },
  );
  return { voces: (r?.voices ?? []).map(aVoz), siguiente: r?.has_more ? (r.next_page_token ?? null) : null };
}

/** Una voz de la cuenta, o null si no existe. */
export async function obtenerVoz(voiceId: string): Promise<VozElevenLabs | null> {
  try {
    return aVoz(await elevenFetch<VozApi>(`/v1/voices/${encodeURIComponent(voiceId)}`, { timeoutMs: 8000 }));
  } catch (e) {
    if (e instanceof ElevenLabsError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

/**
 * Si el agente permite cambiar la voz por conversación (Security → Overrides
 * → Voice). Sin ese permiso, ElevenLabs rechaza las llamadas con otra voz.
 * null: no se pudo saber.
 */
export async function overrideVozActivada(): Promise<boolean | null> {
  const env = elevenLabsAgenteEnv();
  try {
    const r = await elevenFetch<{
      platform_settings?: { overrides?: { conversation_config_override?: { tts?: { voice_id?: boolean } } } };
    }>(`/v1/convai/agents/${encodeURIComponent(env.ELEVENLABS_AGENT_ID)}`, { timeoutMs: 8000 });
    const v = r?.platform_settings?.overrides?.conversation_config_override?.tts?.voice_id;
    return typeof v === "boolean" ? v : null;
  } catch {
    return null;
  }
}

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

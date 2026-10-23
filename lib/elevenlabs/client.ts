import "server-only";
import { elevenLabsEnv } from "@/lib/env";
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
  const env = elevenLabsEnv();
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
  return (await res.json()) as T;
}

export type VariablesDinamicas = Record<string, string | number | boolean>;

type OutboundResponse = {
  success: boolean;
  message: string;
  conversation_id: string | null;
  sip_call_id: string | null;
};

/**
 * Lanza una llamada saliente por el SIP trunk. Sin reintentos: si la red
 * falla después de que ElevenLabs aceptara la petición, reintentar podría
 * llamar dos veces a la misma persona.
 */
export async function llamadaSaliente(telefono: string, variables: VariablesDinamicas) {
  const env = elevenLabsEnv();
  const r = await elevenFetch<OutboundResponse>("/v1/convai/sip-trunk/outbound-call", {
    method: "POST",
    body: {
      agent_id: env.ELEVENLABS_AGENT_ID,
      agent_phone_number_id: env.ELEVENLABS_PHONE_NUMBER_ID,
      to_number: telefono,
      conversation_initiation_client_data: { dynamic_variables: variables },
    },
    timeoutMs: 10_000,
  });
  if (!r.success || !r.conversation_id) {
    throw new ElevenLabsError(r.message || "ElevenLabs no inició la llamada");
  }
  return { conversationId: r.conversation_id, sipCallId: r.sip_call_id };
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

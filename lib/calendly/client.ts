import "server-only";
import { calendlyEnv } from "@/lib/env";
import { log } from "@/lib/log";

/**
 * - hueco_no_disponible: el horario elegido ya no se puede reservar.
 * - auth: token caducado/revocado o plan sin Scheduling API (requiere aviso).
 * - temporal: timeout, red, 429 o 5xx.
 * - validacion: petición rechazada por otro motivo (p. ej. pregunta obligatoria).
 */
export type TipoErrorCalendly = "hueco_no_disponible" | "auth" | "temporal" | "validacion";

export class CalendlyError extends Error {
  constructor(
    readonly tipo: TipoErrorCalendly,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CalendlyError";
  }
}

type CuerpoError = {
  title?: string;
  message?: string;
  details?: readonly { parameter?: string; message?: string; code?: string }[];
};

// Calendly no documenta un código propio para "hueco ocupado": se reconoce
// por el texto o porque el parámetro rechazado es start_time.
const HUECO_OCUPADO = /no longer available|not available|unavailable|already (been )?(booked|taken)|time.*taken/i;

export function clasificarError(status: number, cuerpo: CuerpoError): TipoErrorCalendly {
  if (status === 401 || status === 403) return "auth";
  if (status === 429 || status >= 500) return "temporal";
  const textos = [cuerpo.title, cuerpo.message, ...(cuerpo.details ?? []).flatMap((d) => [d.message, d.code])]
    .filter(Boolean)
    .join(" ");
  if (HUECO_OCUPADO.test(textos)) return "hueco_no_disponible";
  if ((cuerpo.details ?? []).some((d) => d.parameter === "start_time")) return "hueco_no_disponible";
  return "validacion";
}

type Opciones = {
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

export async function calendlyFetch<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const env = calendlyEnv();
  const url = new URL(ruta, env.CALENDLY_API_BASE);
  for (const [k, v] of Object.entries(opciones.query ?? {})) url.searchParams.set(k, v);

  const inicio = performance.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: opciones.method ?? "GET",
      headers: {
        Authorization: `Bearer ${env.CALENDLY_TOKEN}`,
        ...(opciones.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
      signal: AbortSignal.timeout(opciones.timeoutMs ?? 5000),
      cache: "no-store",
    });
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === "TimeoutError";
    log.warn("calendly sin respuesta", { ruta: url.pathname, timeout, ms: Math.round(performance.now() - inicio) });
    throw new CalendlyError("temporal", timeout ? "Timeout de Calendly" : "Error de red con Calendly");
  }

  const ms = Math.round(performance.now() - inicio);
  if (res.ok) {
    log.info("calendly ok", { ruta: url.pathname, status: res.status, ms });
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  const cuerpo = (await res.json().catch(() => ({}))) as CuerpoError;
  const tipo = clasificarError(res.status, cuerpo);
  const nivel = tipo === "auth" || tipo === "validacion" ? "error" : "warn";
  log[nivel]("calendly error", {
    ruta: url.pathname,
    status: res.status,
    ms,
    tipo,
    title: cuerpo.title,
    message: cuerpo.message,
    details: cuerpo.details,
  });
  throw new CalendlyError(tipo, cuerpo.message ?? cuerpo.title ?? `HTTP ${res.status}`, res.status);
}

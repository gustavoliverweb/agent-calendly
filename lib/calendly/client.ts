import "server-only";
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

// Falta un scope de OAuth: Calendly lo devuelve como 403 ("Insufficient scope")
// o como 400 con "missing required scope" en los detalles. Se arregla reconectando.
const SIN_SCOPE = /insufficient scope|missing required scope/i;

export function clasificarError(status: number, cuerpo: CuerpoError): TipoErrorCalendly {
  if (status === 401 || status === 403) return "auth";
  if (status === 429 || status >= 500) return "temporal";
  const textos = [cuerpo.title, cuerpo.message, ...(cuerpo.details ?? []).flatMap((d) => [d.message, d.code])]
    .filter(Boolean)
    .join(" ");
  if (SIN_SCOPE.test(textos)) return "auth";
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

/** Base de la API; se puede cambiar solo para apuntar a un servidor simulado en pruebas. */
export function calendlyApiBase() {
  return process.env.CALENDLY_API_BASE?.trim() || "https://api.calendly.com";
}

/**
 * Petición a la API de Calendly con el token de una empresa (OAuth) o el de
 * entorno. `ruta` puede ser relativa o una URI completa de Calendly.
 */
export async function calendlyFetch<T>(token: string, ruta: string, opciones: Opciones = {}): Promise<T> {
  const url = new URL(ruta, calendlyApiBase());
  for (const [k, v] of Object.entries(opciones.query ?? {})) url.searchParams.set(k, v);

  const inicio = performance.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: opciones.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
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

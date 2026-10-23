import "server-only";
import { calendlyEnv } from "@/lib/env";
import { leerFechaMadrid, madridAUtc } from "@/lib/time/madrid";
import { calendlyFetch } from "./client";

/** Antelación mínima con la que se ofrece un hueco. */
export const MARGEN_MIN_MS = 2 * 60 * 60 * 1000;
/** Rango por defecto si el contacto no da fechas. */
const RANGO_DEFECTO_DIAS = 7;
/** Calendly acepta como máximo 31 días por consulta. */
const RANGO_MAX_DIAS = 31;
const DIA_MS = 86_400_000;
const REDONDEO_MS = 15 * 60_000;
/** Por debajo del SLA de 2 s de la tool, contando la ida y vuelta de ElevenLabs. */
const TIMEOUT_MS = 1500;
const CACHE_TTL_MS = 60_000;

export type Rango = { inicio: Date; fin: Date };

/**
 * Convierte el `desde`/`hasta` (YYYY-MM-DD en Madrid, opcionales) que pide el
 * agente en un rango UTC consultable. Devuelve un error legible si no tiene
 * sentido (fechas mal escritas, todo en el pasado, al revés).
 */
export function calcularRango(
  desde: string | undefined,
  hasta: string | undefined,
  ahora: Date,
): Rango | { error: string } {
  // Redondeado a 15 min: rangos estables para que la caché acierte entre el
  // pre-calentado al lanzar la llamada y la consulta del agente.
  const minimo = new Date(Math.ceil((ahora.getTime() + MARGEN_MIN_MS) / REDONDEO_MS) * REDONDEO_MS);
  const d = desde ? leerFechaMadrid(desde) : null;
  const h = hasta ? leerFechaMadrid(hasta) : null;
  if ((desde && !d) || (hasta && !h)) return { error: "fecha_invalida" };

  const pedidoInicio = d ? madridAUtc(d.anio, d.mes, d.dia) : minimo;
  const inicio = pedidoInicio < minimo ? minimo : pedidoInicio;

  let fin: Date;
  if (h) {
    // Hasta el final del día pedido (inicio del día siguiente).
    const sig = new Date(Date.UTC(h.anio, h.mes - 1, h.dia + 1));
    fin = madridAUtc(sig.getUTCFullYear(), sig.getUTCMonth() + 1, sig.getUTCDate());
  } else {
    fin = new Date(inicio.getTime() + RANGO_DEFECTO_DIAS * DIA_MS);
  }
  if (fin <= inicio) return { error: h && fin <= minimo ? "rango_pasado" : "rango_invertido" };

  const maxFin = new Date(inicio.getTime() + RANGO_MAX_DIAS * DIA_MS);
  return { inicio, fin: fin > maxFin ? maxFin : fin };
}

type AvailableTimes = {
  collection: { status: string; start_time: string; invitees_remaining?: number }[];
};

const cache = new Map<string, { expira: number; valor: Promise<Date[]> }>();

/** Olvida la disponibilidad cacheada (tras reservar o recibir un webhook). */
export function invalidarDisponibilidad() {
  cache.clear();
}

/**
 * Huecos libres del tipo de evento en el rango, con caché de 60 s por rango.
 * Se cachea la promesa para que dos peticiones simultáneas (pre-calentado y
 * la tool) compartan una sola consulta.
 */
export function obtenerDisponibilidad({ inicio, fin }: Rango): Promise<Date[]> {
  const clave = `${inicio.getTime()}|${fin.getTime()}`;
  const ahora = Date.now();
  const enCache = cache.get(clave);
  if (enCache && enCache.expira > ahora) return enCache.valor;

  const valor = calendlyFetch<AvailableTimes>("/event_type_available_times", {
    query: {
      event_type: calendlyEnv().CALENDLY_EVENT_TYPE_URI,
      start_time: inicio.toISOString(),
      end_time: fin.toISOString(),
    },
    timeoutMs: TIMEOUT_MS,
  }).then((r) =>
    r.collection
      .filter((x) => x.status === "available" && (x.invitees_remaining ?? 1) > 0)
      .map((x) => new Date(x.start_time))
      .filter((x) => !Number.isNaN(x.getTime())),
  );

  cache.set(clave, { expira: ahora + CACHE_TTL_MS, valor });
  // Un error no se queda cacheado: el siguiente intento vuelve a consultar.
  valor.catch(() => {
    if (cache.get(clave)?.valor === valor) cache.delete(clave);
  });
  return valor;
}

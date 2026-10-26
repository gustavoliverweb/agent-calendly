import type { Database } from "@/lib/supabase/database.types";
import { siguienteInicioFranja, type Calendario } from "./window";

type ContactoEstado = Database["public"]["Enums"]["contacto_estado"];
type LlamadaEstado = Database["public"]["Enums"]["llamada_estado"];
type ItemEstado = Database["public"]["Enums"]["lote_item_estado"];

export type Clasificacion =
  | "cita_agendada"
  | "no_interesado"
  | "rellamar"
  | "no_llamar"
  | "sin_respuesta"
  | "buzon"
  | "otro";

/** Lo que el agente recoge en "data collection" (IDs configurados en ElevenLabs). */
export type DatosRecogidos = {
  interes?: "si" | "no" | "dudoso";
  motivo_rechazo?: string;
  pide_rellamada?: boolean;
  momento_rellamada?: string;
  pide_no_llamar?: boolean;
};

export type EventoLlamada =
  | { tipo: "fallo_inicio"; motivo: string }
  | {
      tipo: "fin";
      /** El contacto llegó a hablar (hay algún turno del usuario). */
      hablo: boolean;
      buzon: boolean;
      datos: DatosRecogidos;
    };

export type Contexto = {
  /** La tool agendar ya reservó en esta llamada. */
  citaAgendada: boolean;
  /** La tool no_llamar ya marcó la llamada durante la conversación. */
  clasificacionPrevia: string | null;
  contactoEstado: ContactoEstado;
  intentos: number;
  maxReintentos: number;
};

export type CambioContacto =
  | { tipo: "no_llamar" }
  | {
      tipo: "actualizar";
      campos: {
        estado?: ContactoEstado;
        intentos?: number;
        requiere_seguimiento?: boolean;
        seguimiento_motivo?: string;
      };
    }
  | { tipo: "ninguno" };

export type Decision = {
  llamada: { estado: LlamadaEstado; clasificacion: Clasificacion };
  contacto: CambioContacto;
  /** No hubo conversación: cuenta como intento sin respuesta (reintentos). */
  sinRespuesta: boolean;
  /** Sin respuesta y ya sin reintentos: no se vuelve a intentar. */
  reintentosAgotados: boolean;
};

/** Estados desde los que una falta de respuesta puede llevar a no_contesta. */
const ESTADOS_REINTENTABLES: ContactoEstado[] = ["pendiente", "llamado", "no_contesta"];

/**
 * Reglas del plan (§7.2), la primera que aplica gana:
 * 1. pidió no ser llamado → no_llamar (permanente)
 * 2. se reservó cita → cita_agendada
 * 3. no le interesa → no_interesado
 * 4. no contestó / buzón → intentos+1; agotados los reintentos → no_contesta
 * 5. habló sin resultado → llamado (+ seguimiento si pidió rellamada)
 */
export function decidirResultado(ev: EventoLlamada, ctx: Contexto): Decision {
  const estadoLlamada: LlamadaEstado =
    ev.tipo === "fallo_inicio" ? "fallida" : ev.buzon ? "buzon" : "completada";
  const datos = ev.tipo === "fin" ? ev.datos : {};

  if (ctx.clasificacionPrevia === "no_llamar" || datos.pide_no_llamar) {
    return {
      llamada: { estado: estadoLlamada, clasificacion: "no_llamar" },
      contacto: { tipo: "no_llamar" },
      sinRespuesta: false,
      reintentosAgotados: false,
    };
  }
  // Nunca se toca a un excluido (la BD también lo impide).
  if (ctx.contactoEstado === "no_llamar") {
    return { llamada: { estado: estadoLlamada, clasificacion: "otro" }, contacto: { tipo: "ninguno" }, sinRespuesta: false, reintentosAgotados: false };
  }

  if (ctx.citaAgendada) {
    return {
      llamada: { estado: estadoLlamada, clasificacion: "cita_agendada" },
      contacto: { tipo: "actualizar", campos: { estado: "cita_agendada", intentos: 0 } },
      sinRespuesta: false,
      reintentosAgotados: false,
    };
  }

  if (ev.tipo === "fallo_inicio" || ev.buzon || !ev.hablo) {
    const intentos = ctx.intentos + 1;
    const agotado = intentos >= ctx.maxReintentos + 1;
    const campos: { intentos: number; estado?: ContactoEstado } = { intentos };
    if (agotado && ESTADOS_REINTENTABLES.includes(ctx.contactoEstado)) campos.estado = "no_contesta";
    return {
      llamada: { estado: estadoLlamada, clasificacion: ev.tipo === "fin" && ev.buzon ? "buzon" : "sin_respuesta" },
      contacto: { tipo: "actualizar", campos },
      sinRespuesta: true,
      reintentosAgotados: agotado,
    };
  }

  if (datos.interes === "no") {
    return {
      llamada: { estado: estadoLlamada, clasificacion: "no_interesado" },
      contacto: { tipo: "actualizar", campos: { estado: "no_interesado", intentos: 0 } },
      sinRespuesta: false,
      reintentosAgotados: false,
    };
  }

  // Si ya tenía cita de antes (llamada de seguimiento), no se le baja de estado.
  const estado: ContactoEstado = ctx.contactoEstado === "cita_agendada" ? "cita_agendada" : "llamado";
  if (datos.pide_rellamada) {
    const momento = datos.momento_rellamada?.trim();
    return {
      llamada: { estado: estadoLlamada, clasificacion: "rellamar" },
      contacto: {
        tipo: "actualizar",
        campos: {
          estado,
          intentos: 0,
          requiere_seguimiento: true,
          seguimiento_motivo: momento ? `rellamar: ${momento}`.slice(0, 200) : "rellamar",
        },
      },
      sinRespuesta: false,
      reintentosAgotados: false,
    };
  }
  return {
    llamada: { estado: estadoLlamada, clasificacion: "otro" },
    contacto: { tipo: "actualizar", campos: { estado, intentos: 0 } },
    sinRespuesta: false,
    reintentosAgotados: false,
  };
}

export type CambioItem = {
  estado: ItemEstado;
  proximo_intento_en: string | null;
  motivo_omision: string | null;
};

/**
 * Qué pasa con el item de lote cuando termina su llamada (§7.3). Sin
 * respuesta y con reintentos: se reprograma a `horas_entre_reintentos`
 * vista, ajustado al siguiente inicio de franja.
 */
export function decidirItemLote(
  d: Pick<Decision, "sinRespuesta" | "reintentosAgotados">,
  ahora: Date,
  config: Calendario & { horas_entre_reintentos: number },
): CambioItem {
  if (!d.sinRespuesta) return { estado: "completado", proximo_intento_en: null, motivo_omision: null };
  if (d.reintentosAgotados) return { estado: "fallido", proximo_intento_en: null, motivo_omision: "no_contesta" };
  const proximo = siguienteInicioFranja(new Date(ahora.getTime() + config.horas_entre_reintentos * 3_600_000), config);
  return proximo
    ? { estado: "esperando_reintento", proximo_intento_en: proximo.toISOString(), motivo_omision: null }
    : { estado: "fallido", proximo_intento_en: null, motivo_omision: "sin_franja" };
}

const SI = new Set(["true", "si", "sí", "yes", "1"]);

function aBooleano(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string" && v.trim()) return SI.has(v.trim().toLowerCase());
  return undefined;
}

function aTexto(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Lee `data_collection_results` ({ id: { value } }) tolerando tipos sueltos. */
export function leerDatosRecogidos(resultados: unknown): DatosRecogidos {
  if (!resultados || typeof resultados !== "object") return {};
  const valor = (id: string) => {
    const r = (resultados as Record<string, unknown>)[id];
    return r && typeof r === "object" && "value" in r ? (r as { value: unknown }).value : undefined;
  };
  const interes = aTexto(valor("interes"))?.toLowerCase();
  return {
    interes:
      interes === "no"
        ? "no"
        : interes && ["si", "sí", "yes"].includes(interes)
          ? "si"
          : interes
            ? "dudoso"
            : undefined,
    motivo_rechazo: aTexto(valor("motivo_rechazo")),
    pide_rellamada: aBooleano(valor("pide_rellamada")),
    momento_rellamada: aTexto(valor("momento_rellamada")),
    pide_no_llamar: aBooleano(valor("pide_no_llamar")),
  };
}

/** Buzón detectado por la tool de sistema o por el resultado SIP. */
export function esBuzon(terminacion: string | null | undefined, resultadoLlamada: string | null | undefined) {
  return resultadoLlamada === "voicemail" || /voicemail|buz[oó]n/i.test(terminacion ?? "");
}

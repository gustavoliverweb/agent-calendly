import "server-only";
import { z } from "zod";
import { calcularRango, obtenerDisponibilidad } from "@/lib/calendly/availability";
import { CalendlyError } from "@/lib/calendly/client";
import { formatearHueco, unirOpciones } from "@/lib/calendly/format-es";
import { seleccionarHuecos } from "@/lib/calendly/slots";

/** ElevenLabs puede mandar "" en parámetros opcionales que el LLM no rellena. */
const vacioComoNada = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const disponibilidadSchema = z.object({
  desde: z.preprocess(vacioComoNada, z.string().optional()),
  hasta: z.preprocess(vacioComoNada, z.string().optional()),
  llamada_id: z.preprocess(vacioComoNada, z.uuid().optional()),
});

export type RespuestaDisponibilidad = {
  huecos: { texto: string; start_time: string }[];
  mensaje: string;
  error?: "fechas_invalidas" | "calendario_no_disponible";
};

const MENSAJES_RANGO: Record<string, string> = {
  fecha_invalida: "Las fechas deben ir en formato AAAA-MM-DD. Vuelve a consultar con ese formato.",
  rango_pasado: "Esas fechas ya han pasado. Pregunta por fechas a partir de hoy.",
  rango_invertido: "La fecha de inicio es posterior a la de fin. Vuelve a consultar con un rango válido.",
};

export async function consultarDisponibilidad(
  params: { desde?: string; hasta?: string },
  ahora = new Date(),
): Promise<RespuestaDisponibilidad> {
  const rango = calcularRango(params.desde, params.hasta, ahora);
  if ("error" in rango) {
    return { huecos: [], error: "fechas_invalidas", mensaje: MENSAJES_RANGO[rango.error] };
  }

  let libres: Date[];
  try {
    libres = await obtenerDisponibilidad(rango);
  } catch (e) {
    if (!(e instanceof CalendlyError)) throw e;
    return {
      huecos: [],
      error: "calendario_no_disponible",
      mensaje: "Ahora mismo no puedo consultar la agenda. Ofrece que le llamemos más tarde.",
    };
  }

  const huecos = seleccionarHuecos(libres).map((h) => ({
    texto: formatearHueco(h, ahora),
    start_time: h.toISOString(),
  }));
  if (huecos.length === 0) {
    return {
      huecos,
      mensaje: params.desde || params.hasta
        ? "No hay huecos libres entre esas fechas. Puedes proponer otras fechas."
        : "No hay huecos libres en los próximos días. Pregunta si le viene bien más adelante y propón otras fechas.",
    };
  }
  return {
    huecos,
    mensaje: `Hay estos huecos disponibles: ${unirOpciones(huecos.map((h) => h.texto))}.`,
  };
}

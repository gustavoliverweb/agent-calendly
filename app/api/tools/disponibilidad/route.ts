import { after } from "next/server";
import { registrarErrorCalendly } from "@/lib/calendly/conexion";
import { consultarDisponibilidad, disponibilidadSchema } from "@/lib/tools/disponibilidad";
import { leerPeticionTool, respuestaTool } from "@/lib/tools/http";
import { conexionParaTool, empresaDeLlamada, marcarEnCurso, marcarSeguimiento } from "@/lib/tools/llamada";

/** Tool del agente: hasta 3 huecos libres en Calendly, con texto listo para leer. */
export async function POST(req: Request) {
  const inicio = performance.now();
  const peticion = await leerPeticionTool(req, "disponibilidad", disponibilidadSchema);
  if (peticion instanceof Response) return peticion;
  if ("invalido" in peticion) {
    return respuestaTool("disponibilidad", inicio, {
      huecos: [],
      error: "fechas_invalidas",
      mensaje: "Parámetros no válidos. Consulta sin fechas o con fechas en formato AAAA-MM-DD.",
    });
  }

  const { llamada_id, ...rango } = peticion.datos;
  // Una llamada desconocida no es motivo para usar el Calendly de otra empresa.
  const empresaId = llamada_id ? await empresaDeLlamada(llamada_id) : null;
  const conexion = llamada_id && !empresaId ? null : await conexionParaTool(empresaId);
  const respuesta = await consultarDisponibilidad(conexion, rango, new Date(), (status) =>
    conexion ? registrarErrorCalendly(conexion, status === 403 ? "plan_sin_api" : "api_401") : Promise.resolve(),
  );

  // Fuera del camino crítico: no retrasan la respuesta al agente.
  if (llamada_id) {
    after(async () => {
      await marcarEnCurso(llamada_id);
      if (respuesta.error === "calendario_no_disponible") await marcarSeguimiento(llamada_id, "fallo_calendly");
    });
  }

  return respuestaTool("disponibilidad", inicio, respuesta, { llamada_id, huecos: respuesta.huecos.length });
}

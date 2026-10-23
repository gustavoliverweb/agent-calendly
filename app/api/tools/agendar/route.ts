import { after } from "next/server";
import { agendarCita, agendarSchema } from "@/lib/tools/agendar";
import { leerPeticionTool, respuestaTool } from "@/lib/tools/http";
import { marcarEnCurso } from "@/lib/tools/llamada";

/** Tool del agente: reserva el hueco elegido en Calendly. */
export async function POST(req: Request) {
  const inicio = performance.now();
  const peticion = await leerPeticionTool(req, "agendar", agendarSchema);
  if (peticion instanceof Response) return peticion;
  if ("invalido" in peticion) {
    const campos = peticion.invalido;
    return respuestaTool("agendar", inicio, {
      ok: false,
      error: campos.includes("email") ? "email_invalido" : "parametros_invalidos",
      mensaje: campos.includes("email")
        ? "Falta el correo electrónico. Pídeselo al contacto y deletréalo para confirmarlo."
        : "Faltan datos para reservar. Usa el start_time exacto de un hueco de la consulta de disponibilidad.",
    });
  }

  const { llamada_id } = peticion.datos;
  after(() => marcarEnCurso(llamada_id));
  const respuesta = await agendarCita(peticion.datos);
  return respuestaTool("agendar", inicio, respuesta, { llamada_id });
}

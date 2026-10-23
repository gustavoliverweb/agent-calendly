import { leerPeticionTool, respuestaTool } from "@/lib/tools/http";
import { excluirDesdeLlamada, noLlamarSchema } from "@/lib/tools/no-llamar";

/** Tool del agente: "no me llaméis más". Exclusión inmediata y permanente. */
export async function POST(req: Request) {
  const inicio = performance.now();
  const peticion = await leerPeticionTool(req, "no_llamar", noLlamarSchema);
  if (peticion instanceof Response) return peticion;
  if ("invalido" in peticion) {
    // Sin llamada_id no se puede excluir aquí; lo hará el análisis post-llamada.
    return respuestaTool("no_llamar", inicio, {
      ok: true,
      mensaje: "Entendido. No volveremos a llamarle. Despídete amablemente sin insistir.",
    });
  }
  const respuesta = await excluirDesdeLlamada(peticion.datos);
  return respuestaTool("no_llamar", inicio, respuesta, { llamada_id: peticion.datos.llamada_id });
}

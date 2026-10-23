import "server-only";
import { z } from "zod";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

export const noLlamarSchema = z.object({ llamada_id: z.uuid() });

const MENSAJE = "Entendido. No volveremos a llamarle. Despídete amablemente sin insistir.";

/**
 * "No me llaméis más" durante la llamada: exclusión inmediata y permanente.
 * Al agente siempre le responde lo mismo (nunca debe insistir); si falla la
 * BD, el análisis post-llamada (`pide_no_llamar`) lo vuelve a aplicar.
 */
export async function excluirDesdeLlamada(params: z.infer<typeof noLlamarSchema>) {
  const supabase = createAdminClient();
  const { data: llamada } = await supabase
    .from("llamadas")
    .select("contacto_id")
    .eq("id", params.llamada_id)
    .maybeSingle();
  if (!llamada) {
    log.error("no_llamar: llamada no encontrada", { llamada_id: params.llamada_id });
    return { ok: true, mensaje: MENSAJE };
  }

  const { error } = await supabase.rpc("marcar_no_llamar", {
    p_contacto_id: llamada.contacto_id,
    p_origen: "agente",
  });
  if (error) {
    log.error("no_llamar: no se pudo marcar", { llamada_id: params.llamada_id, code: error.code, message: error.message });
  }
  await supabase.from("llamadas").update({ clasificacion: "no_llamar" }).eq("id", params.llamada_id);
  return { ok: true, mensaje: MENSAJE };
}

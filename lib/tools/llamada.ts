import "server-only";
import { empresaPrincipalId } from "@/lib/empresa";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Transitorio hasta la S4 (Calendly por empresa): el único calendario es el
 * de las variables de entorno, que es de la empresa principal. Las llamadas
 * de otras empresas (p. ej. una prueba desde su panel) no lo consultan ni
 * reservan en él.
 */
export async function llamadaConCalendly(llamadaId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("llamadas").select("empresa_id").eq("id", llamadaId).maybeSingle();
  // Una llamada desconocida la trata cada tool como hasta ahora.
  if (!data) return true;
  return data.empresa_id === (await empresaPrincipalId());
}

/** La primera tool que usa el agente demuestra que la llamada está en curso. */
export async function marcarEnCurso(llamadaId: string) {
  const { error } = await createAdminClient()
    .from("llamadas")
    .update({ estado: "en_curso" })
    .eq("id", llamadaId)
    .eq("estado", "iniciada");
  if (error) log.warn("no se pudo marcar en_curso", { llamada_id: llamadaId, code: error.code });
}

/** Deja el contacto de la llamada pendiente de que un humano lo retome. */
export async function marcarSeguimiento(llamadaId: string, motivo: string) {
  const supabase = createAdminClient();
  const { data: llamada } = await supabase.from("llamadas").select("contacto_id").eq("id", llamadaId).maybeSingle();
  if (!llamada) return;
  const { error } = await supabase
    .from("contactos")
    .update({ requiere_seguimiento: true, seguimiento_motivo: motivo })
    .eq("id", llamada.contacto_id);
  if (error) log.error("no se pudo marcar seguimiento", { llamada_id: llamadaId, motivo, code: error.code });
}

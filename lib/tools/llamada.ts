import "server-only";
import { conexionCalendly, type ConexionCalendly } from "@/lib/calendly/conexion";
import { empresaPrincipalId } from "@/lib/empresa";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Calendly con el que trabaja una tool: el de la empresa de la llamada. Sin
 * llamada (p. ej. el tester web de ElevenLabs sin llamada_id), el de la
 * empresa principal. Null si la empresa no tiene Calendly listo o no se puede
 * leer: la tool responde "calendario no disponible".
 */
export async function conexionParaTool(empresaId: string | null): Promise<ConexionCalendly | null> {
  try {
    return await conexionCalendly(empresaId ?? (await empresaPrincipalId()));
  } catch (e) {
    log.error("tool: sin conexión con Calendly", { empresa_id: empresaId, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/** Empresa de una llamada (las tools la deducen de llamada_id, nunca de lo que diga el LLM). */
export async function empresaDeLlamada(llamadaId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("llamadas").select("empresa_id").eq("id", llamadaId).maybeSingle();
  return data?.empresa_id ?? null;
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

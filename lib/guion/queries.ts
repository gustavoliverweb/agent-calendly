import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";
import type { Database } from "@/lib/supabase/database.types";
import type { GuionLlamada } from "./guion";

type Supabase = SupabaseClient<Database>;

export const COLUMNAS_GUION_LLAMADA = "negocio_nombre, nombre_agente, primer_mensaje, texto, voz_id";

/**
 * Guion con el que se hace una llamada: la versión que guardó al crearse
 * (crear_llamada o el motor de lotes). Null si la llamada no tiene guion.
 */
export async function guionDeLlamada(supabase: Supabase, llamadaId: string): Promise<GuionLlamada | null> {
  const { data: llamada, error } = await supabase
    .from("llamadas")
    .select("empresa_id, guion_id")
    .eq("id", llamadaId)
    .maybeSingle();
  if (error) log.error("guion de la llamada", { llamada_id: llamadaId, code: error.code });
  if (!llamada?.guion_id) return null;
  const { data: guion, error: errGuion } = await supabase
    .from("guiones")
    .select(COLUMNAS_GUION_LLAMADA)
    .eq("id", llamada.guion_id)
    .eq("empresa_id", llamada.empresa_id)
    .maybeSingle();
  if (errGuion) log.error("leer guion", { llamada_id: llamadaId, code: errGuion.code });
  return guion;
}

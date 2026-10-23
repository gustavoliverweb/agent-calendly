import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { log } from "@/lib/log";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Registra una acción del panel. Un fallo aquí no debe deshacer la acción
 * principal (ya hecha), pero tampoco puede perderse en silencio.
 */
export async function registrarAuditoria(supabase: Supabase, entrada: TablesInsert<"auditoria">) {
  const { error } = await supabase.from("auditoria").insert(entrada);
  if (error) log.warn("no se pudo registrar auditoría", { accion: entrada.accion, code: error.code, message: error.message });
}

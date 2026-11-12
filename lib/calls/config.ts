import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { festivosSchema, franjasSchema, type Calendario } from "./window";

export type Configuracion = Omit<Tables<"configuracion">, "franjas" | "festivos"> & Calendario;

/** Lee la configuración de una empresa validando las franjas (jsonb). */
export async function leerConfiguracion(supabase: SupabaseClient<Database>, empresaId: string): Promise<Configuracion> {
  const { data, error } = await supabase.from("configuracion").select("*").eq("empresa_id", empresaId).single();
  if (error || !data) throw new Error(`No se pudo leer la configuración: ${error?.message}`);
  return {
    ...data,
    franjas: franjasSchema.parse(data.franjas),
    festivos: festivosSchema.parse(data.festivos),
  };
}

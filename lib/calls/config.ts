import "server-only";
import type { Tables } from "@/lib/supabase/database.types";
import type { createAdminClient } from "@/lib/supabase/admin";
import { festivosSchema, franjasSchema, type Calendario } from "./window";

export type Configuracion = Omit<Tables<"configuracion">, "franjas" | "festivos"> & Calendario;

/** Lee la fila de configuración validando las franjas (jsonb). */
export async function leerConfiguracion(supabase: ReturnType<typeof createAdminClient>): Promise<Configuracion> {
  const { data, error } = await supabase.from("configuracion").select("*").eq("id", 1).single();
  if (error || !data) throw new Error(`No se pudo leer la configuración: ${error?.message}`);
  return {
    ...data,
    franjas: franjasSchema.parse(data.franjas),
    festivos: festivosSchema.parse(data.festivos),
  };
}

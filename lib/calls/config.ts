import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { esTipoCampana, type TipoCampana } from "./config-form";
import { festivosSchema, franjasSchema, type Calendario } from "./window";

export type Configuracion = Omit<Tables<"configuracion">, "franjas" | "festivos" | "tipo_campana"> &
  Calendario & { tipo_campana: TipoCampana };

/** Lee la configuración de una empresa validando las franjas (jsonb). */
export async function leerConfiguracion(supabase: SupabaseClient<Database>, empresaId: string): Promise<Configuracion> {
  const { data, error } = await supabase.from("configuracion").select("*").eq("empresa_id", empresaId).single();
  if (error || !data) throw new Error(`No se pudo leer la configuración: ${error?.message}`);
  return {
    ...data,
    franjas: franjasSchema.parse(data.franjas),
    festivos: festivosSchema.parse(data.festivos),
    // La BD solo admite estos valores (check); por si acaso, lo más restrictivo.
    tipo_campana: esTipoCampana(data.tipo_campana) ? data.tipo_campana : "comercial",
  };
}

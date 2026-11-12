import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type EmpresaActual = {
  id: string;
  nombre: string;
  slug: string;
  estado: string;
  rol: Database["public"]["Enums"]["miembro_rol"];
};

/**
 * Empresa en la que trabaja el usuario de la sesión: la primera de la que es
 * miembro. Cuando cada empresa tenga su dominio (marca blanca), saldrá del
 * dominio de la petición. Redirige a /cuenta/sin-empresa si no pertenece a ninguna.
 *
 * Todas las consultas del panel filtran por este id además de por RLS: RLS
 * deja ver todas las empresas del usuario, y el panel muestra solo una.
 */
export const getEmpresaActual = cache(async (): Promise<EmpresaActual> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("miembros")
    .select("rol, empresas (id, nombre, slug, estado)")
    .eq("usuario_id", user.id)
    .order("creado_en")
    .limit(1)
    .maybeSingle();
  if (!data?.empresas) redirect("/cuenta/sin-empresa");
  return { ...data.empresas, rol: data.rol };
});

/**
 * Empresa dueña de las integraciones que aún se configuran por variables de
 * entorno (Calendly y la línea de ElevenLabs): la más antigua. Transitorio
 * hasta que cada empresa conecte las suyas (fases S4 y S5).
 */
export const empresaPrincipalId = cache(async (): Promise<string> => {
  const { data, error } = await createAdminClient()
    .from("empresas")
    .select("id")
    .order("creado_en")
    .limit(1)
    .single();
  if (error || !data) throw new Error(`No hay ninguna empresa: ${error?.message}`);
  return data.id;
});

import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { COLUMNAS_MARCA, contextoDominio, empresaDeFila, type Marca } from "@/lib/dominio/contexto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type EmpresaActual = {
  id: string;
  nombre: string;
  slug: string;
  estado: string;
  rol: Database["public"]["Enums"]["miembro_rol"];
  marca: Marca;
};

/**
 * Empresa en la que trabaja el usuario de la sesión:
 * - En el dominio de una empresa (marca blanca), esa empresa; si el usuario
 *   no es miembro, a /cuenta/sin-empresa.
 * - En el dominio de la plataforma, la primera de la que es miembro.
 * - En un dominio que no es de nadie, 404.
 *
 * Todas las consultas del panel filtran por este id además de por RLS: RLS
 * deja ver todas las empresas del usuario, y el panel muestra solo una.
 */
export const getEmpresaActual = cache(async (): Promise<EmpresaActual> => {
  const [user, ctx] = await Promise.all([getCurrentUser(), contextoDominio()]);
  if (ctx.tipo === "desconocido") notFound();
  const supabase = await createClient();
  let consulta = supabase
    .from("miembros")
    .select(`rol, empresas (${COLUMNAS_MARCA})`)
    .eq("usuario_id", user.id);
  if (ctx.tipo === "empresa") consulta = consulta.eq("empresa_id", ctx.empresa.id);
  const { data } = await consulta.order("creado_en").limit(1).maybeSingle();
  if (!data?.empresas) redirect("/cuenta/sin-empresa");
  const e = empresaDeFila(data.empresas);
  return { id: e.id, nombre: e.nombre, slug: e.slug, estado: e.estado, rol: data.rol, marca: e.marca };
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

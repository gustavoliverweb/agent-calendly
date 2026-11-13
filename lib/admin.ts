import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Si el usuario de la sesión administra la plataforma (el proveedor del SaaS). */
export const esAdminPlataforma = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  const { data } = await createAdminClient()
    .from("admins_plataforma")
    .select("usuario_id")
    .eq("usuario_id", user.id)
    .maybeSingle();
  return Boolean(data);
});

/**
 * Para /admin y sus acciones: responde 404 a quien no es administrador, sin
 * revelar que la sección existe.
 */
export async function requireAdminPlataforma() {
  if (!(await esAdminPlataforma())) notFound();
  return getCurrentUser();
}

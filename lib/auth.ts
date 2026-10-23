import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
};

/**
 * Usuario de la sesión actual, validado contra Supabase Auth.
 * Redirige a /login si no hay sesión. Lee cookies: llamar siempre
 * dentro de un <Suspense> o desde Server Actions / Route Handlers.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { id: data.user.id, email: data.user.email ?? "" };
});

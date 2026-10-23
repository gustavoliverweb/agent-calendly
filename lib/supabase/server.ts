import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente con la sesión del usuario (cookies). Respeta RLS.
 * Crear uno por petición: nunca reutilizar entre peticiones.
 */
export async function createClient() {
  // Supabase lee la hora (Date.now) para comprobar si la sesión caducó:
  // eso solo puede ocurrir con una petición real, nunca al prerenderizar.
  await connection();
  const env = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: no se pueden escribir cookies.
            // El proxy se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}

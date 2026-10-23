import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente con service role: salta RLS. Solo para tools, webhooks y cron,
 * nunca con datos que vengan del navegador sin validar.
 */
export function createAdminClient() {
  const env = supabaseEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

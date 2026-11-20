import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { respuestaMuestra } from "@/lib/voces";

/** Muestra de audio de una voz activa del catálogo, para el selector del guion. */
export async function GET(_req: Request, ctx: RouteContext<"/app/guion/muestra/[voz]">) {
  await getCurrentUser();
  const { voz } = await ctx.params;
  // Con la sesión: RLS solo deja ver las voces activas.
  const { data } = await (await createClient()).from("voces").select("muestra_url").eq("voice_id", voz).maybeSingle();
  return respuestaMuestra(data?.muestra_url ?? null);
}

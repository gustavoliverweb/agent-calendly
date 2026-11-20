import { requireAdminPlataforma } from "@/lib/admin";
import { obtenerVoz } from "@/lib/elevenlabs/client";
import { VOICE_ID } from "@/lib/guion/guion";
import { respuestaMuestra } from "@/lib/voces";

/** Muestra de cualquier voz de la cuenta de ElevenLabs, para elegir qué añadir al catálogo. */
export async function GET(_req: Request, ctx: RouteContext<"/admin/voces/muestra/[voz]">) {
  await requireAdminPlataforma();
  const { voz } = await ctx.params;
  if (!VOICE_ID.test(voz)) return new Response(null, { status: 404 });
  // La URL de la muestra se pide a ElevenLabs: nunca viene de la petición.
  const datos = await obtenerVoz(voz).catch(() => null);
  return respuestaMuestra(datos?.muestraUrl ?? null);
}

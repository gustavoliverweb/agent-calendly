import "server-only";
import { formatoAudio } from "@/lib/formato-audio";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Voz del catálogo tal como la ve el selector del guion. */
export type VozOfrecida = { voiceId: string; nombre: string; descripcion: string; muestra: boolean };

/** Voces activas del catálogo, para el selector del guion (con la sesión: RLS deja ver solo las activas). */
export async function vocesOfrecidas(): Promise<VozOfrecida[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("voces")
    .select("voice_id, nombre, descripcion, muestra_url")
    .eq("activa", true)
    .order("orden")
    .order("nombre");
  if (error) {
    log.warn("no se pudo leer el catálogo de voces", { code: error.code });
    return [];
  }
  return data.map((v) => ({ voiceId: v.voice_id, nombre: v.nombre, descripcion: v.descripcion, muestra: Boolean(v.muestra_url) }));
}

/**
 * Si una empresa puede guardar un guion con esta voz: la del agente (null),
 * una activa del catálogo o la del guion que ya tiene activo (si el proveedor
 * desactiva una voz, quien la usa puede seguir editando su guion sin cambiarla).
 */
export async function vozPermitida(empresaId: string, vozId: string | null): Promise<boolean> {
  if (vozId == null) return true;
  const supabase = createAdminClient();
  const { data: voz } = await supabase.from("voces").select("activa").eq("voice_id", vozId).maybeSingle();
  if (voz?.activa) return true;
  const { data: empresa } = await supabase.from("empresas").select("guion_activo_id").eq("id", empresaId).maybeSingle();
  if (!empresa?.guion_activo_id) return false;
  const { data: activo } = await supabase
    .from("guiones")
    .select("voz_id")
    .eq("id", empresa.guion_activo_id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return activo?.voz_id === vozId;
}

const MAX_MUESTRA = 3 * 1024 * 1024;

/**
 * Descarga la muestra de audio de una voz y la devuelve como respuesta propia:
 * así la página no carga audio de un dominio de terceros (la CSP no lo
 * permite) y la URL nunca la escribe nadie a mano: sale de ElevenLabs.
 */
export async function respuestaMuestra(url: string | null): Promise<Response> {
  if (!url?.startsWith("https://")) return new Response(null, { status: 404 });
  try {
    // Sin redirecciones: una https externa no puede desviar la petición a la
    // red interna (las muestras de ElevenLabs se sirven sin redirigir).
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error" });
    const largo = Number(res.headers.get("content-length") ?? 0);
    if (!res.ok || !res.body || largo > MAX_MUESTRA) return new Response(null, { status: 502 });
    const audio = await leerConTope(res.body, MAX_MUESTRA);
    if (!audio) return new Response(null, { status: 502 });
    // El tipo se deduce del contenido: el Content-Type de origen no es fiable.
    const tipo = formatoAudio(audio.subarray(0, 16));
    if (!tipo) return new Response(null, { status: 502 });
    return new Response(audio, {
      headers: { "Content-Type": tipo, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}

/**
 * Lee el cuerpo entero si no pasa de `max` bytes; si pasa, corta la descarga
 * y devuelve null (sin Content-Length el tope no se puede comprobar antes).
 */
async function leerConTope(cuerpo: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const lector = cuerpo.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lector.cancel();
      return null;
    }
    trozos.push(value);
  }
  const audio = new Uint8Array(total);
  let i = 0;
  for (const t of trozos) {
    audio.set(t, i);
    i += t.byteLength;
  }
  return audio;
}

/** Cuántas empresas usan cada voz en su guion activo (voice_id → empresas). */
export async function usoDeVoces(): Promise<Map<string, number>> {
  const supabase = createAdminClient();
  const { data: empresas } = await supabase.from("empresas").select("guion_activo_id").not("guion_activo_id", "is", null);
  const ids = (empresas ?? []).map((e) => e.guion_activo_id!).filter(Boolean);
  const uso = new Map<string, number>();
  if (!ids.length) return uso;
  const { data: guiones } = await supabase.from("guiones").select("voz_id").in("id", ids).not("voz_id", "is", null);
  for (const g of guiones ?? []) uso.set(g.voz_id!, (uso.get(g.voz_id!) ?? 0) + 1);
  return uso;
}

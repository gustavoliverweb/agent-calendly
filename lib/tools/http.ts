import "server-only";
import type { z } from "zod";
import { appEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { igualesSeguro } from "@/lib/security/hmac";

/** Las tools reciben unos pocos campos: nada justifica un body grande. */
const MAX_BODY = 16 * 1024;

/**
 * Autentica y valida la petición de una tool del agente. Devuelve una
 * Response si hay que cortar (401/413) o los datos ya validados.
 *
 * Un body inválido no devuelve 4xx sino `invalido`, para que la tool responda
 * 200 con un mensaje que el LLM pueda usar para corregirse.
 */
export async function leerPeticionTool<T extends z.ZodType>(
  req: Request,
  tool: string,
  schema: T,
): Promise<Response | { datos: z.infer<T> } | { invalido: string }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !igualesSeguro(token, appEnv().TOOLS_SECRET)) {
    log.warn("tool sin autorización", { tool });
    return new Response(null, { status: 401 });
  }

  const texto = await req.text();
  if (texto.length > MAX_BODY) return new Response(null, { status: 413 });

  let json: unknown;
  try {
    json = texto ? JSON.parse(texto) : {};
  } catch {
    return { invalido: "json" };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const campos = parsed.error.issues.map((i) => i.path.join(".") || "(raíz)");
    log.warn("tool con parámetros inválidos", { tool, campos });
    return { invalido: campos.join(",") };
  }
  return { datos: parsed.data };
}

/** Respuesta JSON de una tool, con su latencia registrada. */
export function respuestaTool(tool: string, inicio: number, cuerpo: Record<string, unknown>, extra = {}) {
  log.info("tool", {
    tool,
    ms: Math.round(performance.now() - inicio),
    ok: !("error" in cuerpo),
    error: cuerpo.error,
    ...extra,
  });
  return Response.json(cuerpo);
}

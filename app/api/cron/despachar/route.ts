import { despachar } from "@/lib/calls/dispatcher";
import { appEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { igualesSeguro } from "@/lib/security/hmac";

/**
 * Una pasada del motor de lotes. La dispara cada minuto pg_cron (POST) o
 * Vercel Cron (GET), siempre con `Authorization: Bearer <CRON_SECRET>`.
 */
async function handler(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token || !igualesSeguro(token, appEnv().CRON_SECRET)) {
    log.warn("cron sin autorización");
    return new Response(null, { status: 401 });
  }
  return Response.json(await despachar());
}

export { handler as GET, handler as POST };

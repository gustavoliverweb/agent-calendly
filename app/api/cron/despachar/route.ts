import { despachar } from "@/lib/calls/dispatcher";
import { appEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { igualesSeguro } from "@/lib/security/hmac";
import { ipCliente, limitarFallosAuth } from "@/lib/security/rate-limit";

/**
 * Una pasada del motor de lotes. La dispara cada minuto pg_cron (POST), siempre
 * con `Authorization: Bearer <CRON_SECRET>`. GET sirve para probarla a mano.
 */
async function handler(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token || !igualesSeguro(token, appEnv().CRON_SECRET)) {
    const permitido = limitarFallosAuth(`cron:${ipCliente(req)}`);
    log.warn("cron sin autorización", { limitado: !permitido });
    return new Response(null, { status: permitido ? 401 : 429 });
  }
  return Response.json(await despachar());
}

export { handler as GET, handler as POST };

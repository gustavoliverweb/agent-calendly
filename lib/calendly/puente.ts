import { createHmac } from "node:crypto";
import { z } from "zod";
import { igualesSeguro } from "@/lib/security/hmac";

/**
 * Calendly admite una sola redirect URI (en el dominio de la plataforma) y
 * las sesiones son por dominio (marca blanca). Cuando "Conectar con Calendly"
 * se pulsa en el dominio de una empresa, el servidor firma quién lo pidió y
 * a dónde volver, y el navegador sigue el flujo en el dominio de la plataforma.
 *
 * El token caduca en pocos minutos y solo autoriza a empezar la conexión: al
 * volver de Calendly se comprueba otra vez que el usuario es propietario.
 */

export const VIGENCIA_PUENTE_MS = 5 * 60_000;

const puenteSchema = z.object({
  e: z.uuid(), // empresa
  u: z.uuid(), // usuario que pulsó "Conectar"
  o: z.url(), // origen al que volver (dominio de la empresa)
  x: z.number().int(), // caduca (ms)
});

export type Puente = z.infer<typeof puenteSchema>;

/** Clave propia derivada de ENCRYPTION_KEY: no se reutiliza la del cifrado tal cual. */
function clave(encryptionKey: string): Buffer {
  return createHmac("sha256", Buffer.from(encryptionKey, "base64")).update("calendly-oauth-puente").digest();
}

const firma = (cuerpo: string, encryptionKey: string) =>
  createHmac("sha256", clave(encryptionKey)).update(cuerpo).digest("base64url");

export function firmarPuente(datos: Omit<Puente, "x">, encryptionKey: string, ahora = Date.now()): string {
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, x: ahora + VIGENCIA_PUENTE_MS })).toString("base64url");
  return `${cuerpo}.${firma(cuerpo, encryptionKey)}`;
}

export function verificarPuente(token: string | null, encryptionKey: string, ahora = Date.now()): Puente | null {
  if (!token || token.length > 2000) return null;
  const [cuerpo, sello, ...resto] = token.split(".");
  if (!cuerpo || !sello || resto.length || !igualesSeguro(sello, firma(cuerpo, encryptionKey))) return null;
  try {
    const r = puenteSchema.safeParse(JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")));
    return r.success && r.data.x > ahora ? r.data : null;
  } catch {
    return null;
  }
}

/**
 * Marca un token como usado: cada enlace sirve para empezar una sola conexión.
 * En memoria de la instancia (Render ejecuta una); el token caduca igualmente
 * a los pocos minutos. Devuelve false si ya se había usado.
 */
const usados = new Map<string, number>();

export function consumirPuente(token: string, caduca: number, ahora = Date.now()): boolean {
  for (const [t, x] of usados) if (x <= ahora) usados.delete(t);
  const sello = token.split(".")[1] ?? token;
  if (usados.has(sello)) return false;
  usados.set(sello, caduca);
  return true;
}

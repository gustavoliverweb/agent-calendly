import "server-only";
import { z } from "zod";

/**
 * Variables de entorno del servidor, validadas por grupos.
 *
 * Cada grupo se valida la primera vez que se usa: así la app puede arrancar
 * (y desplegarse) aunque falten las claves de una integración que todavía no
 * está configurada, pero falla con un mensaje claro en cuanto se necesita.
 */

const secret = (min = 16) => z.string().trim().min(min);

const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: secret(),
  SUPABASE_SERVICE_ROLE_KEY: secret(),
});

// El agente basta para las pruebas en el navegador; las llamadas por
// teléfono necesitan además la línea SIP.
const elevenLabsAgenteSchema = z.object({
  ELEVENLABS_API_KEY: secret(),
  ELEVENLABS_AGENT_ID: secret(1),
  // Solo para apuntar a un servidor simulado en pruebas.
  ELEVENLABS_API_BASE: z.url().default("https://api.elevenlabs.io"),
});

const elevenLabsSchema = elevenLabsAgenteSchema.extend({
  ELEVENLABS_PHONE_NUMBER_ID: secret(1),
});

const elevenLabsWebhookSchema = z.object({
  ELEVENLABS_WEBHOOK_SECRET: secret(),
});

const opcional = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

const calendlySchema = z.object({
  CALENDLY_TOKEN: secret(),
  CALENDLY_EVENT_TYPE_URI: z.url(),
  // Solo para apuntar a un servidor simulado en pruebas.
  CALENDLY_API_BASE: z.url().default("https://api.calendly.com"),
  // Ubicación a enviar al reservar, si el tipo de evento la necesita.
  CALENDLY_LOCATION_KIND: opcional,
  CALENDLY_LOCATION: opcional,
});

const calendlyWebhookSchema = z.object({
  CALENDLY_WEBHOOK_SIGNING_KEY: secret(),
});

/** Scopes que pide la app (deben estar marcados también en la app OAuth de Calendly). */
export const CALENDLY_SCOPES = "users:read event_types:read scheduled_events:write webhooks:write";

// App OAuth de la plataforma en Calendly (Developer tools → OAuth apps).
// Cada empresa conecta su cuenta con ella (S4).
const calendlyOAuthSchema = z.object({
  CALENDLY_OAUTH_CLIENT_ID: secret(1),
  CALENDLY_OAUTH_CLIENT_SECRET: secret(),
  CALENDLY_OAUTH_WEBHOOK_SIGNING_KEY: secret(),
  // 32 bytes en base64 (openssl rand -base64 32): cifra los tokens en la BD.
  ENCRYPTION_KEY: z
    .string()
    .trim()
    .refine((v) => Buffer.from(v, "base64").length === 32, "32 bytes en base64"),
  // Vacío: no se envía `scope` al autorizar (valen los marcados en la app).
  CALENDLY_OAUTH_SCOPES: z.string().trim().default(CALENDLY_SCOPES),
  // Solo para apuntar a servidores simulados en pruebas.
  CALENDLY_AUTH_BASE: z.url().default("https://auth.calendly.com"),
  CALENDLY_API_BASE: z.url().default("https://api.calendly.com"),
});

const appSchema = z.object({
  APP_URL: z.url(),
  TOOLS_SECRET: secret(32),
  CRON_SECRET: secret(32),
  COSTE_MINUTO_ESTIMADO: z.coerce.number().nonnegative().default(0.12),
  // Con SMTP propio configurado en Supabase Auth, las invitaciones se envían
  // por email; sin él, el panel muestra el enlace para enviarlo a mano.
  INVITACIONES_POR_EMAIL: z.stringbool().default(false),
});

function loader<T extends z.ZodType>(name: string, schema: T) {
  let cached: z.infer<T> | undefined;
  return (): z.infer<T> => {
    if (cached) return cached;
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const vars = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Configuración incompleta (${name}): revisa ${vars}`);
    }
    cached = parsed.data;
    return cached;
  };
}

export const supabaseEnv = loader("Supabase", supabaseSchema);
export const elevenLabsAgenteEnv = loader("ElevenLabs (agente)", elevenLabsAgenteSchema);
export const elevenLabsEnv = loader("ElevenLabs", elevenLabsSchema);
export const elevenLabsWebhookEnv = loader("ElevenLabs webhook", elevenLabsWebhookSchema);
export const calendlyEnv = loader("Calendly", calendlySchema);
export const calendlyWebhookEnv = loader("Calendly webhook", calendlyWebhookSchema);
export const calendlyOAuthEnv = loader("Calendly OAuth", calendlyOAuthSchema);
export const appEnv = loader("App", appSchema);

/** Indica si un grupo de variables está completo, sin lanzar error. */
export function isConfigured(load: () => unknown): boolean {
  try {
    load();
    return true;
  } catch {
    return false;
  }
}

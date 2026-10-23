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

const elevenLabsSchema = z.object({
  ELEVENLABS_API_KEY: secret(),
  ELEVENLABS_AGENT_ID: secret(1),
  ELEVENLABS_PHONE_NUMBER_ID: secret(1),
  // Solo para apuntar a un servidor simulado en pruebas.
  ELEVENLABS_API_BASE: z.url().default("https://api.elevenlabs.io"),
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

const appSchema = z.object({
  APP_URL: z.url(),
  TOOLS_SECRET: secret(32),
  CRON_SECRET: secret(32),
  NEGOCIO_NOMBRE: z.string().trim().default(""),
  COSTE_MINUTO_ESTIMADO: z.coerce.number().nonnegative().default(0.12),
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
export const elevenLabsEnv = loader("ElevenLabs", elevenLabsSchema);
export const elevenLabsWebhookEnv = loader("ElevenLabs webhook", elevenLabsWebhookSchema);
export const calendlyEnv = loader("Calendly", calendlySchema);
export const calendlyWebhookEnv = loader("Calendly webhook", calendlyWebhookSchema);
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

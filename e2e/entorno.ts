import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";

/**
 * Entorno de las pruebas e2e. Todo lo sensible se fija aquí de forma
 * explícita: las variables de proceso tienen prioridad sobre .env.local, así
 * que la app nunca ve las claves reales de ElevenLabs, Calendly ni Render.
 *
 * - Supabase: el proyecto de pruebas de .env.test.
 * - ElevenLabs y Calendly: el simulador local (e2e/simulador). La app
 *   construye las URLs con rutas absolutas (new URL("/v1/…", base)), así que
 *   la base es la raíz del simulador.
 * - Se niega a arrancar si .env.test apunta al proyecto de producción.
 */

export const PUERTO_APP = 3123;
export const PUERTO_SIMULADOR = 3124;
export const PUERTO_CONTROL = 3125;
export const APP_URL = `http://localhost:${PUERTO_APP}`;
/** Dirección de una empresa en su propio dominio (marca blanca). */
export const urlEmpresa = (slug: string, ruta = "/") => `http://${slug}.localhost:${PUERTO_APP}${ruta}`;
/** API simulada, por HTTPS como las reales (la app solo acepta muestras de audio https). */
export const SIMULADOR_URL = `https://localhost:${PUERTO_SIMULADOR}`;
/** Control del simulador (peticiones recibidas, reinicio, salud), por HTTP. */
export const CONTROL_URL = `http://localhost:${PUERTO_CONTROL}`;

/**
 * Certificado autofirmado para localhost, solo para el simulador. La app de
 * pruebas lo acepta con NODE_EXTRA_CA_CERTS (no afecta a nada más) y Chrome
 * con ignoreHTTPSErrors. Se crea la primera vez y dura 30 días.
 */
export const CERTIFICADO = { clave: "e2e/.certs/clave.pem", cert: "e2e/.certs/cert.pem" };
if (!existsSync(CERTIFICADO.cert)) {
  mkdirSync("e2e/.certs", { recursive: true });
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30",
    "-keyout", CERTIFICADO.clave, "-out", CERTIFICADO.cert,
    "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ], { stdio: "ignore" });
}

function leer(archivo: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/\s+#.*$/, "").trim();
  }
  return out;
}

const pruebas = leer(".env.test");
const produccion = leer(".env.local");

for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PROJECT_REF"]) {
  if (!pruebas[k]) throw new Error(`e2e: falta ${k} en .env.test`);
}
if (
  pruebas.SUPABASE_PROJECT_REF === produccion.SUPABASE_PROJECT_REF ||
  pruebas.NEXT_PUBLIC_SUPABASE_URL === produccion.NEXT_PUBLIC_SUPABASE_URL ||
  !pruebas.NEXT_PUBLIC_SUPABASE_URL.includes(pruebas.SUPABASE_PROJECT_REF)
) {
  throw new Error("e2e: .env.test apunta al proyecto de PRODUCCIÓN o es incoherente. No se ejecuta nada.");
}

export const SUPABASE = {
  url: pruebas.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: pruebas.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceKey: pruebas.SUPABASE_SERVICE_ROLE_KEY,
  ref: pruebas.SUPABASE_PROJECT_REF,
};

// Playwright carga este módulo en varios procesos (configuración y workers):
// la semilla se crea una vez y la heredan por el entorno, así todos derivan
// los mismos secretos que el servidor.
process.env.E2E_SEMILLA ??= randomBytes(16).toString("hex");
const derivar = (nombre: string) => createHash("sha256").update(`${process.env.E2E_SEMILLA}:${nombre}`).digest();

/** Secretos de las pruebas: distintos en cada ejecución, nunca los reales. */
export const SECRETOS = {
  cron: "e2e-cron-" + derivar("cron").toString("hex").slice(0, 24),
  tools: "e2e-tools-" + derivar("tools").toString("hex").slice(0, 24),
  webhookElevenLabs: "e2e-wh-el-" + derivar("wh-el").toString("hex").slice(0, 24),
  webhookCalendly: "e2e-wh-cal-" + derivar("wh-cal").toString("hex").slice(0, 24),
  webhookCalendlyOAuth: "e2e-wh-calo-" + derivar("wh-calo").toString("hex").slice(0, 24),
  encryptionKey: derivar("encryption").toString("base64"),
};

/** Variables con las que arranca la app en las pruebas (compilación y servidor). */
export function entornoApp(): Record<string, string> {
  return {
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_EXTRA_CA_CERTS: CERTIFICADO.cert,
    APP_URL,
    PLATFORM_HOSTS: "",
    // Marca blanca en local: <slug>.localhost es el dominio de cada empresa
    // (Chrome resuelve *.localhost a esta máquina sin tocar /etc/hosts).
    BASE_DOMAIN: "localhost",
    INVITACIONES_POR_EMAIL: "false",
    COSTE_MINUTO_ESTIMADO: "0.12",
    NEGOCIO_NOMBRE: "Empresa de pruebas",
    // Supabase de pruebas.
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: SUPABASE.serviceKey,
    SUPABASE_PROJECT_REF: SUPABASE.ref,
    SUPABASE_DB_PASSWORD: "",
    // Secretos propios de las pruebas.
    CRON_SECRET: SECRETOS.cron,
    TOOLS_SECRET: SECRETOS.tools,
    ENCRYPTION_KEY: SECRETOS.encryptionKey,
    // ElevenLabs simulado.
    ELEVENLABS_API_BASE: SIMULADOR_URL,
    ELEVENLABS_API_KEY: "e2e-clave-falsa-elevenlabs-0000",
    ELEVENLABS_AGENT_ID: "agent_e2e",
    ELEVENLABS_PHONE_NUMBER_ID: "phnum_e2e_plataforma",
    ELEVENLABS_WEBHOOK_SECRET: SECRETOS.webhookElevenLabs,
    // Calendly simulado (cuenta de entorno de la empresa principal y OAuth).
    CALENDLY_API_BASE: SIMULADOR_URL,
    CALENDLY_AUTH_BASE: SIMULADOR_URL,
    CALENDLY_TOKEN: "e2e-calendly-token-falso-000000",
    CALENDLY_EVENT_TYPE_URI: `${SIMULADOR_URL}/event_types/e2e`,
    CALENDLY_LOCATION_KIND: "google_conference",
    CALENDLY_WEBHOOK_SIGNING_KEY: SECRETOS.webhookCalendly,
    CALENDLY_OAUTH_CLIENT_ID: "e2e-cliente-oauth-falso-0000000",
    CALENDLY_OAUTH_CLIENT_SECRET: "e2e-secreto-oauth-falso-0000000",
    CALENDLY_OAUTH_WEBHOOK_SIGNING_KEY: SECRETOS.webhookCalendlyOAuth,
    // Sin API de Render: los dominios solo se comprueban por DNS.
    RENDER_API_KEY: "",
    RENDER_SERVICE_ID: "",
    RENDER_SERVICE_HOST: "",
  };
}

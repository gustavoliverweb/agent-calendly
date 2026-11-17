import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * CSP sin nonces: con Cache Components / PPR el shell estático no puede
 * llevar nonce, así que los scripts inline de Next necesitan 'unsafe-inline'.
 * Aun así limita a dónde se conecta la página, quién la enmarca y bloquea
 * plugins y <base> inyectados. Sin upgrade-insecure-requests: lo cubre HSTS
 * y rompería las pruebas en http://localhost.
 *
 * "Probar en el navegador" (/app/guion) habla con ElevenLabs por WebSocket,
 * usa el micrófono y carga sus audio worklets desde blob:. Va en toda la app
 * y no solo en esa ruta porque la navegación en cliente conserva las
 * cabeceras de la primera página cargada. Un blob: solo lo puede crear un
 * script que ya se ejecuta en la página, y el micrófono queda limitado a
 * este origen.
 */
const elevenLabs = "https://api.elevenlabs.io wss://api.elevenlabs.io";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' blob:${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Logos y favicons de las empresas (bucket público "marca" de Supabase Storage).
  `img-src 'self' blob: data:${supabase ? ` ${supabase}` : ""}`,
  "font-src 'self'",
  `connect-src 'self' ${elevenLabs}${supabase ? ` ${supabase} ${supabase.replace(/^http/, "ws")}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Importación CSV de hasta 5.000 contactos en una Server Action.
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

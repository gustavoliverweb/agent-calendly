import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { appEnv, calendlyOAuthEnv } from "@/lib/env";
import { log } from "@/lib/log";

/**
 * OAuth 2.0 de Calendly con PKCE (obligatorio, S256). El secreto de la app va
 * por HTTP Basic en /oauth/token y en el cuerpo en /oauth/revoke, como indica
 * la documentación. El access token dura 2 h; el refresh token es de un solo
 * uso (cada renovación devuelve uno nuevo e invalida el anterior).
 */

export const RUTA_CALLBACK = "/api/calendly/oauth/callback";

export function redirectUri() {
  return new URL(RUTA_CALLBACK, appEnv().APP_URL).toString();
}

export function generarPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function urlAutorizacion(challenge: string, state: string): string {
  const env = calendlyOAuthEnv();
  const url = new URL("/oauth/authorize", env.CALENDLY_AUTH_BASE);
  url.searchParams.set("client_id", env.CALENDLY_OAUTH_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  // No documentado en la referencia de /oauth/authorize, pero sí en la guía de
  // scopes. Si Calendly lo ignora, no pasa nada; si lo devuelve, se comprueba.
  url.searchParams.set("state", state);
  if (env.CALENDLY_OAUTH_SCOPES) url.searchParams.set("scope", env.CALENDLY_OAUTH_SCOPES);
  return url.toString();
}

export type TokensCalendly = {
  accessToken: string;
  refreshToken: string;
  expiraEn: Date;
  usuarioUri: string;
  organizacionUri: string;
};

export class OAuthCalendlyError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** La autorización ya no vale (código o refresh token usado, revocado…): hay que reconectar. */
    readonly invalidGrant = false,
  ) {
    super(message);
    this.name = "OAuthCalendlyError";
  }
}

type RespuestaToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  created_at?: number;
  owner: string;
  organization: string;
};

async function postAuth(ruta: string, cuerpo: Record<string, string>, basic: boolean): Promise<unknown> {
  const env = calendlyOAuthEnv();
  const url = new URL(ruta, env.CALENDLY_AUTH_BASE);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(basic
          ? {
              Authorization: `Basic ${Buffer.from(`${env.CALENDLY_OAUTH_CLIENT_ID}:${env.CALENDLY_OAUTH_CLIENT_SECRET}`).toString("base64")}`,
            }
          : {}),
      },
      body: new URLSearchParams(cuerpo),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === "TimeoutError";
    log.warn("calendly oauth sin respuesta", { ruta, timeout });
    throw new OAuthCalendlyError(timeout ? "Calendly no respondió a tiempo" : "Error de red con Calendly");
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string };
  if (!res.ok) {
    // Solo invalid_grant desconecta: un 401 por credenciales de la app mal
    // configuradas no debe dejar sin Calendly a todas las empresas.
    const invalidGrant = json.error === "invalid_grant";
    log.warn("calendly oauth error", { ruta, status: res.status, error: json.error });
    throw new OAuthCalendlyError(json.error_description ?? json.error ?? `HTTP ${res.status}`, res.status, invalidGrant);
  }
  return json;
}

function leerTokens(r: RespuestaToken): TokensCalendly {
  if (!r.access_token || !r.refresh_token || !r.owner || !r.organization) {
    throw new OAuthCalendlyError("Respuesta de token incompleta");
  }
  const inicio = r.created_at ? r.created_at * 1000 : Date.now();
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiraEn: new Date(inicio + (r.expires_in || 7200) * 1000),
    usuarioUri: r.owner,
    organizacionUri: r.organization,
  };
}

export async function canjearCodigo(code: string, verifier: string): Promise<TokensCalendly> {
  const r = await postAuth(
    "/oauth/token",
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: calendlyOAuthEnv().CALENDLY_OAUTH_CLIENT_ID,
      code_verifier: verifier,
    },
    true,
  );
  return leerTokens(r as RespuestaToken);
}

export async function refrescarToken(refreshToken: string): Promise<TokensCalendly> {
  const r = await postAuth(
    "/oauth/token",
    { grant_type: "refresh_token", refresh_token: refreshToken, client_id: calendlyOAuthEnv().CALENDLY_OAUTH_CLIENT_ID },
    true,
  );
  return leerTokens(r as RespuestaToken);
}

/** Revoca un token (al desconectar). Un fallo no impide desconectar. */
export async function revocarToken(token: string): Promise<void> {
  const env = calendlyOAuthEnv();
  try {
    await postAuth(
      "/oauth/revoke",
      { client_id: env.CALENDLY_OAUTH_CLIENT_ID, client_secret: env.CALENDLY_OAUTH_CLIENT_SECRET, token },
      false,
    );
  } catch (e) {
    log.warn("calendly: no se pudo revocar el token", { error: e instanceof Error ? e.message : String(e) });
  }
}

import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canjearCodigo, generarPkce, refrescarToken, urlAutorizacion, OAuthCalendlyError } from "@/lib/calendly/oauth";
import { claveDesdeBase64, cifrar, descifrar } from "@/lib/security/cifrado";

describe("cifrado de tokens", () => {
  const clave = randomBytes(32);

  it("cifra y descifra", () => {
    const c = cifrar("token-secreto", clave);
    expect(c).toMatch(/^v1\./);
    expect(c).not.toContain("token-secreto");
    expect(descifrar(c, clave)).toBe("token-secreto");
  });

  it("cada cifrado es distinto (IV aleatorio)", () => {
    expect(cifrar("x", clave)).not.toBe(cifrar("x", clave));
  });

  it("rechaza un texto manipulado o una clave distinta", () => {
    const c = cifrar("token-secreto", clave);
    const partes = c.split(".");
    partes[3] = Buffer.from("otra cosa").toString("base64url");
    expect(() => descifrar(partes.join("."), clave)).toThrow();
    expect(() => descifrar(c, randomBytes(32))).toThrow();
    expect(() => descifrar("basura", clave)).toThrow();
  });

  it("exige una clave de 32 bytes", () => {
    expect(() => claveDesdeBase64(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
    expect(claveDesdeBase64(randomBytes(32).toString("base64"))).toHaveLength(32);
  });
});

describe("OAuth de Calendly", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    vi.stubEnv("TOOLS_SECRET", "t".repeat(32));
    vi.stubEnv("CRON_SECRET", "c".repeat(32));
    vi.stubEnv("CALENDLY_OAUTH_CLIENT_ID", "cliente-id");
    vi.stubEnv("CALENDLY_OAUTH_CLIENT_SECRET", "secreto-de-la-app-123");
    vi.stubEnv("CALENDLY_OAUTH_WEBHOOK_SIGNING_KEY", "clave-firma-webhooks-123");
    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("PKCE: el challenge es el SHA-256 del verifier en base64url", () => {
    const { verifier, challenge } = generarPkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("la URL de autorización lleva PKCE S256, redirect URI, state y scopes", () => {
    const u = new URL(urlAutorizacion("reto", "estado-123"));
    expect(u.origin + u.pathname).toBe("https://auth.calendly.com/oauth/authorize");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: "cliente-id",
      response_type: "code",
      redirect_uri: "https://app.example.com/api/calendly/oauth/callback",
      code_challenge_method: "S256",
      code_challenge: "reto",
      state: "estado-123",
      scope: "users:read event_types:read scheduled_events:write webhooks:write",
    });
  });

  const respuestaToken = () =>
    Response.json({
      token_type: "Bearer",
      access_token: "acceso",
      refresh_token: "renovar",
      created_at: 1_800_000_000,
      expires_in: 7200,
      owner: "https://api.calendly.com/users/U1",
      organization: "https://api.calendly.com/organizations/O1",
    });

  it("canjea el código con Basic auth y el code_verifier", async () => {
    fetchMock.mockResolvedValueOnce(respuestaToken());
    const t = await canjearCodigo("codigo", "verificador");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://auth.calendly.com/oauth/token");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("cliente-id:secreto-de-la-app-123").toString("base64")}`);
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({
      grant_type: "authorization_code",
      code: "codigo",
      redirect_uri: "https://app.example.com/api/calendly/oauth/callback",
      client_id: "cliente-id",
      code_verifier: "verificador",
    });
    expect(t).toEqual({
      accessToken: "acceso",
      refreshToken: "renovar",
      expiraEn: new Date((1_800_000_000 + 7200) * 1000),
      usuarioUri: "https://api.calendly.com/users/U1",
      organizacionUri: "https://api.calendly.com/organizations/O1",
    });
  });

  it("un refresh token ya usado o revocado es invalid_grant (hay que reconectar)", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "invalid_grant" }, { status: 400 }));
    const e = await refrescarToken("viejo").catch((x) => x);
    expect(e).toBeInstanceOf(OAuthCalendlyError);
    expect(e.invalidGrant).toBe(true);
  });

  it("un 401 por credenciales de la app no desconecta a la empresa", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "invalid_client" }, { status: 401 }));
    const e = await refrescarToken("r").catch((x) => x);
    expect(e.invalidGrant).toBe(false);
  });
});

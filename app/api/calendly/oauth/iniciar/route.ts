import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_OAUTH, type EstadoOAuth } from "@/lib/calendly/conectar";
import { generarPkce, redirectUri, urlAutorizacion } from "@/lib/calendly/oauth";
import { consumirPuente, firmarPuente, type Puente, verificarPuente } from "@/lib/calendly/puente";
import { getCurrentUser } from "@/lib/auth";
import { hostActual, origenActual } from "@/lib/dominio/contexto";
import { normalizarHost } from "@/lib/dominio/hosts";
import { getEmpresaActual } from "@/lib/empresa";
import { calendlyOAuthEnv, isConfigured } from "@/lib/env";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "Conectar con Calendly": guarda el verificador PKCE en una cookie de 10
 * minutos y manda al usuario a autorizar en Calendly. Solo el propietario.
 *
 * La redirect URI está en el dominio de la plataforma. Si se pulsa en el
 * dominio de una empresa, se redirige a esta misma ruta en el de la
 * plataforma con un token firmado (?t=), que hace allí de sesión. Como ese
 * enlace se podría reenviar a otra persona, no salta directamente a Calendly:
 * muestra a qué empresa se va a conectar y quién lo pidió, y solo continúa
 * con un POST desde esa misma página (comprobando Origin), una sola vez.
 */
export async function GET(request: NextRequest) {
  if (!isConfigured(calendlyOAuthEnv)) return volver("sin_configurar");
  const env = calendlyOAuthEnv();
  const plataforma = new URL(redirectUri());
  const enPlataforma = (await hostActual()) === normalizarHost(plataforma.host);

  const token = request.nextUrl.searchParams.get("t");
  if (token) {
    const puente = enPlataforma ? verificarPuente(token, env.ENCRYPTION_KEY) : null;
    if (!puente) return caducado();
    return confirmacion(token, puente);
  }

  await getCurrentUser();
  const empresa = await getEmpresaActual();
  // Relativas: detrás del proxy de Render la URL de la petición lleva el host interno.
  if (empresa.rol !== "propietario") return volver("solo_propietario");

  if (!enPlataforma) {
    const user = await getCurrentUser();
    const t = firmarPuente({ e: empresa.id, u: user.id, o: await origenActual() }, env.ENCRYPTION_KEY);
    const destino = new URL("/api/calendly/oauth/iniciar", plataforma.origin);
    destino.searchParams.set("t", t);
    return NextResponse.redirect(destino, 303);
  }
  return autorizar({ e: empresa.id });
}

/** "Continuar a Calendly" de la página de confirmación. */
export async function POST(request: NextRequest) {
  if (!isConfigured(calendlyOAuthEnv)) return volver("sin_configurar");
  const env = calendlyOAuthEnv();
  const plataforma = new URL(redirectUri());
  if ((await hostActual()) !== normalizarHost(plataforma.host)) return caducado();

  // Solo desde la propia página de confirmación: un formulario de otra web no
  // puede saltarse la confirmación enviando el token por su cuenta.
  const origen = request.headers.get("origin");
  if (!origen || normalizarHost(safeHost(origen)) !== normalizarHost(plataforma.host)) {
    log.warn("calendly oauth: confirmación desde otro origen", { origen });
    return new NextResponse("Petición no válida.", { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const token = form?.get("t");
  const puente = typeof token === "string" ? verificarPuente(token, env.ENCRYPTION_KEY) : null;
  if (!puente || typeof token !== "string") return caducado();
  if (!consumirPuente(token, puente.x)) {
    return new NextResponse("Este enlace ya se ha usado. Vuelve a pulsar «Conectar» en tu panel.", { status: 400 });
  }
  return autorizar({ e: puente.e, u: puente.u, o: puente.o });
}

async function autorizar(datos: Pick<EstadoOAuth, "e" | "u" | "o">) {
  const { verifier, challenge } = generarPkce();
  const state = randomBytes(16).toString("base64url");
  const estado: EstadoOAuth = { v: verifier, s: state, ...datos };

  (await cookies()).set(COOKIE_OAUTH, Buffer.from(JSON.stringify(estado)).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: la vuelta desde Calendly es una navegación normal y sí la lleva.
    sameSite: "lax",
    path: "/api/calendly/oauth",
    maxAge: 600,
  });
  return NextResponse.redirect(urlAutorizacion(challenge, state), 303);
}

/** Página mínima (sin el layout de la app) que pide confirmar la conexión. */
async function confirmacion(token: string, puente: Puente) {
  const admin = createAdminClient();
  const [{ data: empresa }, { data: usuario }] = await Promise.all([
    admin.from("empresas").select("nombre").eq("id", puente.e).maybeSingle(),
    admin.auth.admin.getUserById(puente.u),
  ]);
  if (!empresa) return caducado();
  const email = usuario?.user?.email ?? "un usuario de la empresa";

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Conectar Calendly</title>
<style>
  body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #fafafa; color: #1c1517; }
  main { max-width: 32rem; margin: 12vh auto; padding: 0 1.5rem; }
  h1 { font-size: 1.6rem; line-height: 1.2; margin: 0 0 1rem; }
  p { line-height: 1.6; color: #4a4245; }
  strong { color: #1c1517; }
  .aviso { margin-top: 1.5rem; padding: 1rem 1.25rem; border-radius: .75rem; background: #fff1f1; color: #48060e; }
  button { margin-top: 1.75rem; height: 3rem; padding: 0 1.5rem; border: 0; border-radius: 999px; background: #e11d2e; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  button:hover { background: #be1325; }
  button:focus-visible { outline: 2px solid #1c1517; outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <h1>Conectar tu Calendly a ${escapar(empresa.nombre)}</h1>
  <p>Lo ha pedido <strong>${escapar(email)}</strong> desde el panel de la empresa. Al continuar, Calendly te pedirá permiso y el agente podrá consultar tu disponibilidad y reservar citas en tu calendario para esta empresa.</p>
  <p class="aviso">Si no has pulsado tú «Conectar con Calendly», o no conoces esta empresa, cierra esta página.</p>
  <form method="post" action="/api/calendly/oauth/iniciar">
    <input type="hidden" name="t" value="${escapar(token)}">
    <button type="submit">Continuar a Calendly</button>
  </form>
</main>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "same-origin" },
  });
}

function caducado() {
  return new NextResponse("El enlace para conectar Calendly ha caducado. Vuelve a pulsar «Conectar».", { status: 400 });
}

function volver(error: string) {
  return new NextResponse(null, { status: 303, headers: { Location: `/app/calendly?error=${error}` } });
}

function safeHost(origen: string): string {
  try {
    return new URL(origen).host;
  } catch {
    return "";
  }
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

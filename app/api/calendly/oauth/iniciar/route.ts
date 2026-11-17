import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_OAUTH, type EstadoOAuth } from "@/lib/calendly/conectar";
import { generarPkce, redirectUri, urlAutorizacion } from "@/lib/calendly/oauth";
import { firmarPuente, verificarPuente } from "@/lib/calendly/puente";
import { getCurrentUser } from "@/lib/auth";
import { hostActual, origenActual } from "@/lib/dominio/contexto";
import { normalizarHost } from "@/lib/dominio/hosts";
import { getEmpresaActual } from "@/lib/empresa";
import { calendlyOAuthEnv, isConfigured } from "@/lib/env";

/**
 * "Conectar con Calendly": guarda el verificador PKCE en una cookie de 10
 * minutos y manda al usuario a autorizar en Calendly. Solo el propietario.
 *
 * La redirect URI está en el dominio de la plataforma. Si se pulsa en el
 * dominio de una empresa, se redirige a esta misma ruta en el de la
 * plataforma con un token firmado (?t=), que hace allí de sesión.
 */
export async function GET(request: NextRequest) {
  if (!isConfigured(calendlyOAuthEnv)) return volver("sin_configurar");
  const env = calendlyOAuthEnv();
  const plataforma = new URL(redirectUri());
  const enPlataforma = (await hostActual()) === normalizarHost(plataforma.host);

  const token = request.nextUrl.searchParams.get("t");
  if (token) {
    const puente = enPlataforma ? verificarPuente(token, env.ENCRYPTION_KEY) : null;
    if (!puente) return new NextResponse("El enlace para conectar Calendly ha caducado. Vuelve a pulsar «Conectar».", { status: 400 });
    return autorizar({ e: puente.e, u: puente.u, o: puente.o });
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

function volver(error: string) {
  return new NextResponse(null, { status: 303, headers: { Location: `/app/calendly?error=${error}` } });
}

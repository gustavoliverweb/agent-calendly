import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_OAUTH, type EstadoOAuth } from "@/lib/calendly/conectar";
import { generarPkce, urlAutorizacion } from "@/lib/calendly/oauth";
import { getCurrentUser } from "@/lib/auth";
import { getEmpresaActual } from "@/lib/empresa";
import { calendlyOAuthEnv, isConfigured } from "@/lib/env";

/**
 * "Conectar con Calendly": guarda el verificador PKCE en una cookie de 10
 * minutos y manda al usuario a autorizar en Calendly. Solo el propietario.
 */
export async function GET() {
  await getCurrentUser();
  const empresa = await getEmpresaActual();
  // Relativas: detrás del proxy de Render la URL de la petición lleva el host interno.
  if (empresa.rol !== "propietario") return volver("solo_propietario");
  if (!isConfigured(calendlyOAuthEnv)) return volver("sin_configurar");

  const { verifier, challenge } = generarPkce();
  const state = randomBytes(16).toString("base64url");
  const estado: EstadoOAuth = { v: verifier, s: state, e: empresa.id };

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

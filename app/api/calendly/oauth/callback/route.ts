import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_OAUTH, completarConexion, leerEstadoOAuth } from "@/lib/calendly/conectar";
import { getCurrentUser } from "@/lib/auth";

/** Vuelta de Calendly tras autorizar (redirect URI de la app OAuth). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const almacen = await cookies();
  const estado = leerEstadoOAuth(almacen.get(COOKIE_OAUTH)?.value);
  almacen.delete({ name: COOKIE_OAUTH, path: "/api/calendly/oauth" });

  const q = request.nextUrl.searchParams;
  const resultado = await completarConexion({
    usuarioId: user.id,
    estado,
    code: q.get("code"),
    state: q.get("state"),
    error: q.get("error"),
  });

  // Relativa: detrás del proxy de Render la URL de la petición lleva el host interno.
  const destino = "error" in resultado ? `/app/calendly?error=${resultado.error}` : "/app/calendly?conectado=1";
  return new NextResponse(null, { status: 303, headers: { Location: destino } });
}

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_OAUTH, completarConexion, leerEstadoOAuth } from "@/lib/calendly/conectar";
import { getCurrentUser } from "@/lib/auth";
import { origenEsDeEmpresa } from "@/lib/dominio/contexto";

/**
 * Vuelta de Calendly tras autorizar (redirect URI de la app OAuth). Si la
 * conexión empezó en el dominio de una empresa, el usuario viene en la cookie
 * (firmado al empezar) y se vuelve a su dominio; completarConexion comprueba
 * igualmente que es propietario.
 */
export async function GET(request: NextRequest) {
  const almacen = await cookies();
  const estado = leerEstadoOAuth(almacen.get(COOKIE_OAUTH)?.value);
  almacen.delete({ name: COOKIE_OAUTH, path: "/api/calendly/oauth" });

  const usuarioId = estado?.u ?? (await getCurrentUser()).id;
  const q = request.nextUrl.searchParams;
  const resultado = await completarConexion({
    usuarioId,
    estado,
    code: q.get("code"),
    state: q.get("state"),
    error: q.get("error"),
  });

  const ruta = "error" in resultado ? `/app/calendly?error=${resultado.error}` : "/app/calendly?conectado=1";
  // Relativa en el mismo dominio: detrás del proxy de Render la URL de la petición lleva el host interno.
  const origen = estado?.o && estado.e && (await origenEsDeEmpresa(estado.o, estado.e)) ? new URL(estado.o).origin : "";
  return new NextResponse(null, { status: 303, headers: { Location: `${origen}${ruta}` } });
}

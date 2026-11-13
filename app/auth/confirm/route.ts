import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { rutaInterna } from "@/lib/security/redirect";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "email", "email_change", "signup"];

/**
 * Destino de los enlaces de los correos de Supabase (invitación y
 * recuperación de contraseña). Admite los dos formatos:
 * - `token_hash` + `type` (plantillas de supabase/templates/)
 * - `code` (flujo PKCE, p. ej. resetPasswordForEmail con la plantilla por defecto)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = new URL(rutaInterna(searchParams.get("next"), "/app"), request.nextUrl.origin);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let error: { message: string } | null = null;

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: "enlace sin token" };
  }
  if (error) log.warn("enlace de acceso no válido", { tipo: type ?? (code ? "code" : null), motivo: error.message });

  // Relativa: detrás del proxy de Render, la URL de la petición lleva el host
  // interno (localhost:10000), no el público.
  const destino = error ? "/login?error=enlace_invalido" : `${next.pathname}${next.search}`;
  return new NextResponse(null, { status: 307, headers: { Location: destino } });
}

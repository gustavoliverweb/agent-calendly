"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rutaInterna } from "@/lib/security/redirect";
import { contextoDominio, origenActual } from "@/lib/dominio/contexto";

export type LoginState = { error?: string; info?: string };

const loginSchema = z.object({
  email: z.email("Introduce un email válido"),
  password: z.string().min(1, "Introduce la contraseña"),
  next: z.string().optional(),
});

export async function iniciarSesion(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: "Email o contraseña incorrectos" };

  // En el dominio de una empresa solo entran sus miembros (marca blanca).
  const ctx = await contextoDominio();
  if (ctx.tipo === "desconocido") {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "Este dominio no está configurado." };
  }
  if (ctx.tipo === "empresa") {
    const { data: miembro } = await supabase
      .from("miembros")
      .select("rol")
      .eq("empresa_id", ctx.empresa.id)
      .eq("usuario_id", data.user.id)
      .maybeSingle();
    if (!miembro) {
      await supabase.auth.signOut({ scope: "local" });
      // Mismo mensaje que con contraseña incorrecta: no revela qué emails existen en otras empresas.
      return { error: "Email o contraseña incorrectos" };
    }
  }

  redirect(rutaInterna(parsed.data.next, "/app"));
}

export async function recuperarContrasena(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Escribe tu email para recuperar la contraseña" };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    // En el dominio desde el que se pide (marca blanca); con correo propio, debe estar en las redirect URLs de Supabase Auth.
    redirectTo: `${await origenActual()}/auth/confirm?next=/cuenta/contrasena`,
  });
  // Misma respuesta exista o no la cuenta, para no revelar qué emails están dados de alta.
  return { info: "Si el email está dado de alta, recibirás un enlace para elegir una contraseña nueva." };
}

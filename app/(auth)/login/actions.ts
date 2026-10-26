"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { appEnv } from "@/lib/env";
import { rutaInterna } from "@/lib/security/redirect";

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
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: "Email o contraseña incorrectos" };

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
    redirectTo: `${appEnv().APP_URL}/auth/confirm?next=/cuenta/contrasena`,
  });
  // Misma respuesta exista o no la cuenta, para no revelar qué emails están dados de alta.
  return { info: "Si el email está dado de alta, recibirás un enlace para elegir una contraseña nueva." };
}

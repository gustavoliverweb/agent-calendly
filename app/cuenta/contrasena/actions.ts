"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { error?: string };

const schema = z
  .object({
    password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres"),
    confirmacion: z.string(),
  })
  .refine((d) => d.password === d.confirmacion, {
    message: "Las contraseñas no coinciden",
  });

export async function cambiarContrasena(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "La contraseña nueva debe ser distinta de la anterior"
          : "No se ha podido guardar la contraseña. Inténtalo de nuevo.",
    };
  }
  redirect("/");
}

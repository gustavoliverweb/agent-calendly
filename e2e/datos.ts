import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import type { Database } from "../lib/supabase/database.types";
import { SIMULADOR_URL, SUPABASE } from "./entorno";

/** Cliente con service role del Supabase de PRUEBAS (entorno.ts ya comprobó que no es producción). */
export const db = createClient<Database>(SUPABASE.url, SUPABASE.serviceKey, { auth: { persistSession: false } });

/** Todo lo que crean las pruebas lleva este dominio o prefijo, para poder limpiarlo. */
export const DOMINIO_EMAIL = "e2e.test";
export const PREFIJO_SLUG = "e2e-";
export const CONTRASENA = "Contrasena-e2e-1234";

export const ADMIN = { email: `admin@${DOMINIO_EMAIL}` };

/** Crea (o recupera) un usuario confirmado con la contraseña de pruebas. */
export async function usuario(email: string): Promise<string> {
  const { data: existente } = await db.rpc("usuario_por_email", { p_email: email });
  if (existente) {
    await db.auth.admin.updateUserById(existente, { password: CONTRASENA });
    return existente;
  }
  const { data, error } = await db.auth.admin.createUser({ email, password: CONTRASENA, email_confirm: true });
  if (error || !data.user) throw new Error(`crear usuario ${email}: ${error?.message}`);
  return data.user.id;
}

/** Entra en el panel por el formulario de acceso. */
export async function entrar(page: Page, email: string, destino = "/app") {
  await page.goto(`/login?next=${encodeURIComponent(destino)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((u) => u.pathname.startsWith(destino));
}

/** Peticiones que ha recibido el simulador de ElevenLabs y Calendly. */
export async function peticionesSimulador(): Promise<{ metodo: string; ruta: string; query: Record<string, string>; cuerpo: unknown }[]> {
  return (await fetch(`${SIMULADOR_URL}/__peticiones`)).json();
}

export async function reiniciarSimulador() {
  await fetch(`${SIMULADOR_URL}/__reiniciar`, { method: "POST" });
}

/**
 * Borra lo que dejaron ejecuciones anteriores: empresas e2e-* (en cascada) y
 * usuarios @e2e.test, y deja la plataforma con sus valores por defecto.
 */
export async function limpiar() {
  const { error } = await db.from("empresas").delete().like("slug", `${PREFIJO_SLUG}%`);
  if (error) throw new Error(`limpiar empresas: ${error.message}`);
  await db.from("voces").delete().like("voice_id", "vozSimulada%");
  await db
    .from("ajustes_plataforma")
    .update({ marca_nombre: null, marca_descripcion: null, marca_email: null, marca_logo: null, marca_favicon: null })
    .eq("id", true);
  for (let pagina = 1; ; pagina++) {
    const { data, error: e } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (e) throw new Error(`listar usuarios: ${e.message}`);
    for (const u of data.users) if (u.email?.endsWith(`@${DOMINIO_EMAIL}`)) await db.auth.admin.deleteUser(u.id);
    if (data.users.length < 200) break;
  }
}

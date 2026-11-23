import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import type { Database } from "../lib/supabase/database.types";
import { CONTROL_URL, SUPABASE } from "./entorno";

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
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => u.pathname.startsWith(destino));
}

/** Peticiones que ha recibido el simulador de ElevenLabs y Calendly. */
export async function peticionesSimulador(): Promise<{ metodo: string; ruta: string; query: Record<string, string>; cuerpo: unknown }[]> {
  return (await fetch(`${CONTROL_URL}/__peticiones`)).json();
}

export async function reiniciarSimulador() {
  await fetch(`${CONTROL_URL}/__reiniciar`, { method: "POST" });
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

/** Empresa de pruebas con su propietario (y, si se pide, un operador), creada directamente en la BD. */
export async function empresaDePrueba(slug: string, nombre: string, opciones: { operador?: string } = {}) {
  // Si ya existe (un worker que se reinicia tras un fallo), se reutiliza con
  // el mismo id: el servidor guarda en caché qué empresa es cada dominio.
  const { data: existente } = await db.from("empresas").select("id").eq("slug", slug).maybeSingle();
  if (existente) {
    await db.from("contactos").delete().eq("empresa_id", existente.id);
    await db.from("miembros").delete().eq("empresa_id", existente.id).neq("rol", "propietario");
    await db.from("empresas").update({ nombre, marca_nombre: null, estado: "activa" }).eq("id", existente.id);
  }
  const { data: empresa, error } = existente
    ? { data: existente, error: null }
    : await db.from("empresas").insert({ nombre, slug }).select("id").single();
  if (error || !empresa) throw new Error(`crear empresa ${slug}: ${error?.message}`);
  const propietario = `propietario-${slug}@${DOMINIO_EMAIL}`;
  const miembros: { empresa_id: string; usuario_id: string; rol: "propietario" | "operador" }[] = [
    { empresa_id: empresa.id, usuario_id: await usuario(propietario), rol: "propietario" },
  ];
  if (opciones.operador) miembros.push({ empresa_id: empresa.id, usuario_id: await usuario(opciones.operador), rol: "operador" });
  const { error: e } = await db.from("miembros").upsert(miembros, { onConflict: "empresa_id,usuario_id" });
  if (e) throw new Error(`miembros de ${slug}: ${e.message}`);
  return { id: empresa.id, slug, nombre, propietario };
}

export async function contactoDePrueba(empresaId: string, nombre: string, telefono: string) {
  const { data, error } = await db
    .from("contactos")
    .insert({ empresa_id: empresaId, nombre, telefono, consentimiento: true })
    .select("id")
    .single();
  if (error || !data) throw new Error(`contacto ${nombre}: ${error?.message}`);
  return data.id;
}

/**
 * Página «no existe». Se comprueba por el contenido, no por el código: el
 * panel responde por partes (streaming) y, cuando la página decide que no
 * existe, la cabecera ya salió con 200.
 */
export async function esperarNoExiste(page: Page) {
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
}

/**
 * Crea un usuario del panel con contraseña, sin enviar correo (mientras no
 * haya SMTP propio para las invitaciones).
 *
 *   pnpm crear-usuario persona@empresa.com
 *
 * Genera una contraseña aleatoria y la muestra una sola vez: cámbiala al
 * entrar en /cuenta/contrasena.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Uso: pnpm crear-usuario <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const password = randomBytes(12).toString("base64url");
const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });

if (error) {
  console.error(`No se pudo crear: ${error.message}`);
  process.exit(1);
}
console.log(`Usuario creado: ${email} (${data.user.id})`);
console.log(`Contraseña provisional: ${password}`);
console.log("Entra en /login y cámbiala en /cuenta/contrasena.");

export {};

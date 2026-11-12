/**
 * Crea un usuario del panel con contraseña, sin enviar correo (mientras no
 * haya SMTP propio para las invitaciones).
 *
 *   pnpm crear-usuario persona@empresa.com [slug-empresa]
 *
 * Lo añade como miembro de la empresa indicada (obligatoria si hay varias);
 * el primer usuario de una empresa entra como propietario.
 * Genera una contraseña aleatoria y la muestra una sola vez: cámbiala al
 * entrar en /cuenta/contrasena.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";

const [email, slug] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Uso: pnpm crear-usuario <email> [slug-empresa]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const password = randomBytes(12).toString("base64url");
const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });

/**
 * Empresa a la que se añade el usuario: la del slug indicado o, si solo hay
 * una, esa. El primer usuario de una empresa entra como propietario.
 */
async function añadirAEmpresa(userId: string, slug: string | undefined) {
  const { data: empresas, error } = await supabase.from("empresas").select("id, nombre, slug");
  if (error) throw new Error(error.message);
  const empresa = slug ? empresas.find((e) => e.slug === slug) : empresas.length === 1 ? empresas[0] : undefined;
  if (!empresa) {
    const lista = empresas.map((e) => e.slug).join(", ");
    throw new Error(slug ? `No hay ninguna empresa "${slug}" (hay: ${lista})` : `Indica la empresa (hay: ${lista})`);
  }
  const { count } = await supabase
    .from("miembros")
    .select("usuario_id", { count: "exact", head: true })
    .eq("empresa_id", empresa.id);
  const rol = count ? "operador" : "propietario";
  const { error: errMiembro } = await supabase.from("miembros").insert({ empresa_id: empresa.id, usuario_id: userId, rol });
  if (errMiembro) throw new Error(errMiembro.message);
  return { ...empresa, rol };
}

// La empresa se comprueba antes de crear el usuario, para no dejarlo huérfano.
const { data: empresas } = await supabase.from("empresas").select("slug");
if (!slug && (empresas?.length ?? 0) > 1) {
  console.error(`Indica la empresa: pnpm crear-usuario <email> <slug> (hay: ${empresas!.map((e) => e.slug).join(", ")})`);
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error(`No se pudo crear: ${error.message}`);
  process.exit(1);
}
try {
  const empresa = await añadirAEmpresa(data.user.id, slug);
  console.log(`Usuario creado: ${email} (${data.user.id}), ${empresa.rol} de ${empresa.nombre}`);
} catch (e) {
  await supabase.auth.admin.deleteUser(data.user.id);
  console.error(`No se pudo añadir a la empresa (usuario no creado): ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
console.log(`Contraseña provisional: ${password}`);
console.log("Entra en /login y cámbiala en /cuenta/contrasena.");

export {};

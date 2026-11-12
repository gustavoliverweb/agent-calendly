/**
 * Invita a un usuario interno al panel (el registro público está desactivado).
 *
 *   pnpm invitar persona@empresa.com [slug-empresa]
 *
 * Lo añade como miembro de la empresa indicada (obligatoria si hay varias);
 * el primer usuario de una empresa entra como propietario.
 *
 * El correo usa la plantilla de invitación de Supabase, que debe apuntar a
 * /auth/confirm (ver supabase/templates/invite.html y el README).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";

const [email, slug] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Uso: pnpm invitar <email> [slug-empresa]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

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

const { data: empresas } = await supabase.from("empresas").select("slug");
if (!slug && (empresas?.length ?? 0) > 1) {
  console.error(`Indica la empresa: pnpm invitar <email> <slug> (hay: ${empresas!.map((e) => e.slug).join(", ")})`);
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${appUrl}/auth/confirm?next=/cuenta/contrasena`,
});

if (error) {
  console.error(`No se pudo invitar: ${error.message}`);
  process.exit(1);
}
try {
  const empresa = await añadirAEmpresa(data.user.id, slug);
  console.log(`Invitación enviada a ${email} (usuario ${data.user.id}), ${empresa.rol} de ${empresa.nombre}`);
} catch (e) {
  console.error(`Invitación enviada, pero no se pudo añadir a la empresa: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

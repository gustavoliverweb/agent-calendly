/**
 * Da (o quita) acceso a /admin, la administración de la plataforma, a un
 * usuario que ya existe.
 *
 *   pnpm admin-plataforma persona@proveedor.com
 *   pnpm admin-plataforma persona@proveedor.com --quitar
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";

const [email, opcion] = process.argv.slice(2);
if (!email || (opcion && opcion !== "--quitar")) {
  console.error("Uso: pnpm admin-plataforma <email> [--quitar]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });
const { data: usuarioId, error } = await supabase.rpc("usuario_por_email", { p_email: email });
if (error || !usuarioId) {
  console.error(error ? `Error: ${error.message}` : `No hay ningún usuario con el email ${email}. Créalo antes.`);
  process.exit(1);
}

const r =
  opcion === "--quitar"
    ? await supabase.from("admins_plataforma").delete().eq("usuario_id", usuarioId)
    : await supabase.from("admins_plataforma").upsert({ usuario_id: usuarioId });
if (r.error) {
  console.error(`Error: ${r.error.message}`);
  process.exit(1);
}
console.log(opcion === "--quitar" ? `${email} ya no administra la plataforma.` : `${email} ya puede entrar en /admin.`);

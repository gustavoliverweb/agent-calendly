/**
 * Invita a un usuario interno al panel (el registro público está desactivado).
 *
 *   node --env-file=.env.local scripts/invitar-usuario.ts persona@empresa.com
 *
 * El correo usa la plantilla de invitación de Supabase, que debe apuntar a
 * /auth/confirm (ver supabase/templates/invite.html y el README).
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Uso: node --env-file=.env.local scripts/invitar-usuario.ts <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${appUrl}/auth/confirm?next=/cuenta/contrasena`,
});

if (error) {
  console.error(`No se pudo invitar: ${error.message}`);
  process.exit(1);
}
console.log(`Invitación enviada a ${email} (usuario ${data.user.id})`);

import { ADMIN, db, limpiar, usuario } from "./datos";
import { SUPABASE } from "./entorno";

/** Antes de todas las pruebas: base de datos de pruebas limpia y un administrador de la plataforma. */
export default async function preparar() {
  console.log(`e2e contra el Supabase de pruebas ${SUPABASE.ref}`);
  await limpiar();
  const id = await usuario(ADMIN.email);
  const { error } = await db.from("admins_plataforma").upsert({ usuario_id: id });
  if (error) throw new Error(`admin de la plataforma: ${error.message}`);
}

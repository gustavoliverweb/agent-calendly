import "server-only";
import { z } from "zod";
import { appEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { origenEmpresa } from "@/lib/dominio/contexto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Altas, roles y bajas de miembros de una empresa. Van con service role:
 * quien llama ya comprobó que puede gestionar esa empresa (propietario en
 * /app/equipo, administrador de la plataforma en /admin).
 */

export type Rol = Database["public"]["Enums"]["miembro_rol"];

export type ResultadoInvitacion =
  | { error: string }
  /** Ya tenía cuenta (p. ej. en otra empresa): entra con su contraseña. */
  | { tipo: "existente" }
  /** Supabase le envió el correo de invitación. */
  | { tipo: "email" }
  /** Sin SMTP propio: el enlace se envía a mano. */
  | { tipo: "enlace"; enlace: string };

export type ResultadoEnlace = { error: string } | { tipo: "email" } | { tipo: "enlace"; enlace: string };

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Email no válido"));
export const rolSchema = z.enum(["propietario", "operador"]);

const UNIQUE_VIOLATION = "23505";

/**
 * Enlace a /auth/confirm, el mismo formato que las plantillas de correo de
 * supabase/templates/, en el dominio de la empresa (marca blanca): la sesión
 * queda en ese dominio. El enlace lo construye la app, así que no hace falta
 * dar de alta cada dominio en las redirect URLs de Supabase Auth.
 */
async function enlaceConfirmacion(empresaId: string, tokenHash: string, tipo: "invite" | "recovery") {
  const url = new URL("/auth/confirm", await origenEmpresa(empresaId));
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", tipo);
  url.searchParams.set("next", "/cuenta/contrasena");
  return url.toString();
}

export async function invitarAEmpresa(empresaId: string, email: string, rol: Rol): Promise<ResultadoInvitacion> {
  const admin = createAdminClient();
  const { data: existente, error: errBuscar } = await admin.rpc("usuario_por_email", { p_email: email });
  if (errBuscar) {
    log.error("invitar: buscar usuario", { code: errBuscar.code });
    return { error: "No se ha podido invitar. Inténtalo de nuevo." };
  }

  if (existente) {
    const { error } = await admin.from("miembros").insert({ empresa_id: empresaId, usuario_id: existente, rol });
    if (error?.code === UNIQUE_VIOLATION) return { error: "Ya es miembro de esta empresa." };
    if (error) {
      log.error("invitar: alta de miembro existente", { code: error.code });
      return { error: "No se ha podido invitar. Inténtalo de nuevo." };
    }
    return { tipo: "existente" };
  }

  // Cuenta nueva: Supabase la crea al generar la invitación.
  let usuarioId: string;
  let resultado: ResultadoInvitacion;
  if (appEnv().INVITACIONES_POR_EMAIL) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      // Con correo, el dominio debe estar en las redirect URLs de Supabase Auth (docs/runbook.md).
      redirectTo: new URL("/auth/confirm?next=/cuenta/contrasena", await origenEmpresa(empresaId)).toString(),
    });
    if (error || !data.user) {
      log.error("invitar: envío de invitación", { message: error?.message });
      return { error: "No se ha podido enviar la invitación. Inténtalo de nuevo." };
    }
    usuarioId = data.user.id;
    resultado = { tipo: "email" };
  } else {
    const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
    if (error || !data.user) {
      log.error("invitar: generar enlace", { message: error?.message });
      return { error: "No se ha podido generar la invitación. Inténtalo de nuevo." };
    }
    usuarioId = data.user.id;
    resultado = { tipo: "enlace", enlace: await enlaceConfirmacion(empresaId, data.properties.hashed_token, "invite") };
  }

  const { error } = await admin.from("miembros").insert({ empresa_id: empresaId, usuario_id: usuarioId, rol });
  if (error) {
    // Sin empresa, la cuenta recién creada no sirve: se deshace.
    await admin.auth.admin.deleteUser(usuarioId);
    log.error("invitar: alta de miembro nuevo", { code: error.code });
    return { error: "No se ha podido invitar. Inténtalo de nuevo." };
  }
  return resultado;
}

/**
 * Si el propietario de una empresa puede generar un enlace de acceso para
 * ese miembro. Sin correo, el enlace inicia sesión como el usuario, así que
 * solo se permite para cuentas que no tienen nada fuera de esta empresa: un
 * usuario de otra empresa o un administrador de la plataforma recupera su
 * acceso él mismo o con el proveedor. Si no, un propietario podría invitar a
 * cualquier cuenta existente y entrar como ella.
 */
export async function accesoPermitidoAPropietario(empresaId: string, usuarioId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const [otras, plataforma] = await Promise.all([
    admin.from("miembros").select("empresa_id", { count: "exact", head: true }).eq("usuario_id", usuarioId).neq("empresa_id", empresaId),
    admin.from("admins_plataforma").select("usuario_id", { count: "exact", head: true }).eq("usuario_id", usuarioId),
  ]);
  if (otras.error || plataforma.error) {
    log.error("acceso: comprobar cuentas", { code: otras.error?.code ?? plataforma.error?.code });
    return { error: "No se ha podido generar el enlace. Inténtalo de nuevo." };
  }
  if ((otras.count ?? 0) > 0 || (plataforma.count ?? 0) > 0) {
    return {
      error:
        "Esta persona también usa la plataforma con otra empresa, así que no puedes generarle un enlace de acceso. Que recupere su contraseña desde la pantalla de acceso o lo pida al proveedor.",
    };
  }
  return {};
}

/**
 * Enlace para que un miembro elija (o restablezca) su contraseña: la
 * invitación caducó o se perdió, o la olvidó y no hay correo propio para
 * "recuperar contraseña". Si lo pide un propietario, antes hay que pasar
 * por accesoPermitidoAPropietario.
 */
export async function nuevoAcceso(empresaId: string, usuarioId: string): Promise<ResultadoEnlace> {
  const admin = createAdminClient();
  const { data: miembro } = await admin
    .from("miembros")
    .select("usuario_id")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (!miembro) return { error: "Ese usuario no es miembro de la empresa." };

  const { data: usuario, error: errUsuario } = await admin.auth.admin.getUserById(usuarioId);
  const email = usuario?.user?.email;
  if (errUsuario || !email) return { error: "No se ha encontrado el usuario." };

  if (appEnv().INVITACIONES_POR_EMAIL) {
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      // Con correo, el dominio debe estar en las redirect URLs de Supabase Auth (docs/runbook.md).
      redirectTo: new URL("/auth/confirm?next=/cuenta/contrasena", await origenEmpresa(empresaId)).toString(),
    });
    if (error) {
      log.error("nuevo acceso: envío", { message: error.message });
      return { error: "No se ha podido enviar el correo. Inténtalo de nuevo." };
    }
    return { tipo: "email" };
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) {
    log.error("nuevo acceso: generar enlace", { message: error.message });
    return { error: "No se ha podido generar el enlace. Inténtalo de nuevo." };
  }
  return { tipo: "enlace", enlace: await enlaceConfirmacion(empresaId, data.properties.hashed_token, "recovery") };
}

const MENSAJE_ULTIMO_PROPIETARIO = "La empresa necesita al menos un propietario: nombra otro antes.";

export async function cambiarRolMiembro(empresaId: string, usuarioId: string, rol: Rol): Promise<{ error?: string }> {
  const { error } = await createAdminClient()
    .from("miembros")
    .update({ rol })
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId);
  if (error?.message === "ultimo_propietario") return { error: MENSAJE_ULTIMO_PROPIETARIO };
  if (error) {
    log.error("cambiar rol", { code: error.code });
    return { error: "No se ha podido cambiar el rol." };
  }
  return {};
}

/**
 * Quita a un miembro de la empresa. Si nunca llegó a entrar y no pertenece a
 * ninguna otra, se borra también su cuenta (era solo una invitación).
 */
export async function quitarMiembro(empresaId: string, usuarioId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("miembros").delete().eq("empresa_id", empresaId).eq("usuario_id", usuarioId);
  if (error?.message === "ultimo_propietario") return { error: MENSAJE_ULTIMO_PROPIETARIO };
  if (error) {
    log.error("quitar miembro", { code: error.code });
    return { error: "No se ha podido quitar al miembro." };
  }

  const [{ count }, { data: usuario }] = await Promise.all([
    admin.from("miembros").select("usuario_id", { count: "exact", head: true }).eq("usuario_id", usuarioId),
    admin.auth.admin.getUserById(usuarioId),
  ]);
  if (!count && usuario?.user && !usuario.user.last_sign_in_at) {
    const { error: errBorrar } = await admin.auth.admin.deleteUser(usuarioId);
    if (errBorrar) log.warn("quitar miembro: no se pudo borrar la invitación", { message: errBorrar.message });
  }
  return {};
}

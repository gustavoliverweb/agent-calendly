"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdminPlataforma } from "@/lib/admin";
import {
  cambiarRolMiembro,
  emailSchema,
  invitarAEmpresa,
  nuevoAcceso,
  quitarMiembro,
  rolSchema,
  type ResultadoEnlace,
  type ResultadoInvitacion,
  type Rol,
} from "@/lib/equipo";
import { log } from "@/lib/log";
import { slugSchema } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

const UNIQUE_VIOLATION = "23505";

/** Las acciones del proveedor se auditan en la empresa afectada. */
async function auditar(usuario: string, empresaId: string, accion: string, entidad: string, detalle?: Json) {
  const { error } = await createAdminClient()
    .from("auditoria")
    .insert({ usuario, empresa_id: empresaId, accion, entidad, entidad_id: empresaId, detalle: detalle ?? null });
  if (error) log.warn("no se pudo registrar auditoría", { accion, code: error.code });
}

const empresaSchema = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre").max(120),
  slug: slugSchema,
  email: emailSchema,
});

export type CrearEmpresaState =
  | { error: string }
  | { empresaId: string; invitacion: Exclude<ResultadoInvitacion, { error: string }> | { error: string } };

/** Alta de una empresa con su primer propietario (altas por invitación). */
export async function crearEmpresa(nombre: string, slug: string, email: string): Promise<CrearEmpresaState> {
  const admin = await requireAdminPlataforma();
  const datos = empresaSchema.safeParse({ nombre, slug, email });
  if (!datos.success) return { error: datos.error.issues[0].message };

  const { data: empresa, error } = await createAdminClient()
    .from("empresas")
    .insert({ nombre: datos.data.nombre, slug: datos.data.slug })
    .select("id")
    .single();
  if (error?.code === UNIQUE_VIOLATION) return { error: "Ya hay una empresa con ese identificador." };
  if (error || !empresa) {
    log.error("crear empresa", { code: error?.code, message: error?.message });
    return { error: "No se ha podido crear la empresa." };
  }

  await auditar(admin.id, empresa.id, "crear_empresa", "empresa", { slug: datos.data.slug });
  // La empresa queda creada aunque falle la invitación: se reintenta desde su ficha.
  const invitacion = await invitarAEmpresa(empresa.id, datos.data.email, "propietario");
  refresh();
  return { empresaId: empresa.id, invitacion };
}

export async function cambiarEstadoEmpresa(
  empresaId: string,
  estado: "activa" | "suspendida",
): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  const datos = z.object({ empresaId: z.uuid(), estado: z.enum(["activa", "suspendida"]) }).safeParse({ empresaId, estado });
  if (!datos.success) return { error: "Datos no válidos" };

  const { error } = await createAdminClient().from("empresas").update({ estado }).eq("id", empresaId);
  if (error) {
    log.error("cambiar estado de empresa", { code: error.code });
    return { error: "No se ha podido cambiar el estado." };
  }
  await auditar(admin.id, empresaId, estado === "suspendida" ? "suspender_empresa" : "reactivar_empresa", "empresa");
  log.warn(estado === "suspendida" ? "empresa suspendida" : "empresa reactivada", { empresa_id: empresaId });
  refresh();
  return {};
}

export async function renombrarEmpresa(empresaId: string, nombre: string): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  const datos = z.object({ empresaId: z.uuid(), nombre: z.string().trim().min(1, "Falta el nombre").max(120) }).safeParse({
    empresaId,
    nombre,
  });
  if (!datos.success) return { error: datos.error.issues[0].message };

  const { error } = await createAdminClient().from("empresas").update({ nombre: datos.data.nombre }).eq("id", empresaId);
  if (error) {
    log.error("renombrar empresa", { code: error.code });
    return { error: "No se ha podido cambiar el nombre." };
  }
  await auditar(admin.id, empresaId, "renombrar_empresa", "empresa");
  refresh();
  return {};
}

// Equipo de cualquier empresa. La ficha de /admin las enlaza con el id de la
// empresa (.bind) para usar el mismo componente que la sección Equipo.

export async function invitarEnEmpresa(empresaId: string, email: string, rol: Rol): Promise<ResultadoInvitacion> {
  const admin = await requireAdminPlataforma();
  const datos = z.object({ empresaId: z.uuid(), email: emailSchema, rol: rolSchema }).safeParse({ empresaId, email, rol });
  if (!datos.success) return { error: datos.error.issues[0].message };
  const r = await invitarAEmpresa(empresaId, datos.data.email, datos.data.rol);
  if (!("error" in r)) {
    await auditar(admin.id, empresaId, "invitar_miembro", "miembro", { rol: datos.data.rol, tipo: r.tipo });
    refresh();
  }
  return r;
}

export async function cambiarRolEnEmpresa(empresaId: string, usuarioId: string, rol: Rol): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  const datos = z.object({ empresaId: z.uuid(), usuarioId: z.uuid(), rol: rolSchema }).safeParse({ empresaId, usuarioId, rol });
  if (!datos.success) return { error: "Datos no válidos" };
  const r = await cambiarRolMiembro(empresaId, usuarioId, datos.data.rol);
  if (!r.error) {
    await auditar(admin.id, empresaId, "cambiar_rol", "miembro", { rol: datos.data.rol });
    refresh();
  }
  return r;
}

export async function quitarDeEmpresa(empresaId: string, usuarioId: string): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  if (!z.uuid().safeParse(empresaId).success || !z.uuid().safeParse(usuarioId).success) return { error: "Datos no válidos" };
  const r = await quitarMiembro(empresaId, usuarioId);
  if (!r.error) {
    await auditar(admin.id, empresaId, "quitar_miembro", "miembro");
    refresh();
  }
  return r;
}

export async function accesoEnEmpresa(empresaId: string, usuarioId: string): Promise<ResultadoEnlace> {
  await requireAdminPlataforma();
  if (!z.uuid().safeParse(empresaId).success || !z.uuid().safeParse(usuarioId).success) return { error: "Datos no válidos" };
  return nuevoAcceso(empresaId, usuarioId);
}

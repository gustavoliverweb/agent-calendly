"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { getEmpresaActual } from "@/lib/empresa";
import {
  accesoPermitidoAPropietario,
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
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

const NO_PROPIETARIO = { error: "Solo el propietario de la empresa puede gestionar el equipo." };

/** El equipo lo gestiona solo el propietario de la empresa actual. */
async function comoPropietario() {
  const [user, empresa] = await Promise.all([getCurrentUser(), getEmpresaActual()]);
  return empresa.rol === "propietario" ? { user, empresa } : null;
}

async function auditar(accion: string, empresaId: string, usuario: string, entidadId: string | null, detalle?: Json) {
  await registrarAuditoria(await createClient(), {
    usuario,
    empresa_id: empresaId,
    accion,
    entidad: "miembro",
    entidad_id: entidadId,
    detalle: detalle ?? null,
  });
}

export async function invitar(email: string, rol: Rol): Promise<ResultadoInvitacion> {
  const quien = await comoPropietario();
  if (!quien) return NO_PROPIETARIO;
  const datos = z.object({ email: emailSchema, rol: rolSchema }).safeParse({ email, rol });
  if (!datos.success) return { error: datos.error.issues[0].message };

  const r = await invitarAEmpresa(quien.empresa.id, datos.data.email, datos.data.rol);
  if (!("error" in r)) {
    await auditar("invitar_miembro", quien.empresa.id, quien.user.id, null, { rol: datos.data.rol, tipo: r.tipo });
    refresh();
  }
  return r;
}

export async function cambiarRol(usuarioId: string, rol: Rol): Promise<{ error?: string }> {
  const quien = await comoPropietario();
  if (!quien) return NO_PROPIETARIO;
  const datos = z.object({ usuarioId: z.uuid(), rol: rolSchema }).safeParse({ usuarioId, rol });
  if (!datos.success) return { error: "Datos no válidos" };

  const r = await cambiarRolMiembro(quien.empresa.id, datos.data.usuarioId, datos.data.rol);
  if (!r.error) {
    await auditar("cambiar_rol", quien.empresa.id, quien.user.id, datos.data.usuarioId, { rol: datos.data.rol });
    refresh();
  }
  return r;
}

export async function quitar(usuarioId: string): Promise<{ error?: string }> {
  const quien = await comoPropietario();
  if (!quien) return NO_PROPIETARIO;
  if (!z.uuid().safeParse(usuarioId).success) return { error: "Datos no válidos" };

  const r = await quitarMiembro(quien.empresa.id, usuarioId);
  if (!r.error) {
    await auditar("quitar_miembro", quien.empresa.id, quien.user.id, usuarioId);
    refresh();
  }
  return r;
}

export async function generarAcceso(usuarioId: string): Promise<ResultadoEnlace> {
  const quien = await comoPropietario();
  if (!quien) return NO_PROPIETARIO;
  if (!z.uuid().safeParse(usuarioId).success) return { error: "Datos no válidos" };
  const permitido = await accesoPermitidoAPropietario(quien.empresa.id, usuarioId);
  if (permitido.error) return { error: permitido.error };
  return nuevoAcceso(quien.empresa.id, usuarioId);
}

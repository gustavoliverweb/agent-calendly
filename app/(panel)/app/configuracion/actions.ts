"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { configuracionFormSchema, type ConfiguracionForm } from "@/lib/calls/config-form";
import { despachar } from "@/lib/calls/dispatcher";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

export type GuardarState = { ok?: boolean; error?: string };

export async function guardarConfiguracion(datos: ConfiguracionForm): Promise<GuardarState> {
  const user = await getCurrentUser();
  const parsed = configuracionFormSchema.safeParse(datos);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: i.path[0] === "franjas" ? `Franjas: ${i.message}` : i.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracion")
    .update({ ...parsed.data, actualizado_por: user.id })
    .eq("id", 1);
  if (error) {
    log.error("guardar configuración", { code: error.code, message: error.message });
    return { error: "No se ha podido guardar la configuración." };
  }

  await registrarAuditoria(supabase, {
    usuario: user.id,
    accion: "editar_configuracion",
    entidad: "configuracion",
    detalle: parsed.data,
  });
  // Más concurrencia o una franja nueva pueden permitir llamar ya.
  after(() => despachar());
  refresh();
  return { ok: true };
}

/** Interruptor de emergencia: detiene todo despacho nuevo al instante. */
export async function cambiarPausaGlobal(activar: boolean): Promise<GuardarState> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracion")
    .update({ pausa_global: activar === true, actualizado_por: user.id })
    .eq("id", 1);
  if (error) {
    log.error("pausa global", { code: error.code, message: error.message });
    return { error: "No se ha podido cambiar la pausa global." };
  }

  await registrarAuditoria(supabase, {
    usuario: user.id,
    accion: activar ? "activar_pausa_global" : "desactivar_pausa_global",
    entidad: "configuracion",
  });
  log.warn(activar ? "pausa global activada" : "pausa global desactivada");
  if (!activar) after(() => despachar());
  refresh();
  return { ok: true };
}

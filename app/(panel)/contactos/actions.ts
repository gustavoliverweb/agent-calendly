"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { contactoFormSchema } from "@/lib/contacts/schema";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import { registrarAuditoria } from "@/lib/auditoria";
import { borrarConversacion } from "@/lib/elevenlabs/client";
import { elevenLabsEnv, isConfigured } from "@/lib/env";

export type FormState = { error?: string; ok?: boolean; id?: string };

const UNIQUE_VIOLATION = "23505";
const uuid = z.uuid();

export async function crearContacto(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const parsed = contactoFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { error: "Ya existe un contacto con ese teléfono" };
    log.error("crear contacto", { code: error.code, message: error.message });
    return { error: "No se ha podido crear el contacto" };
  }

  await registrarAuditoria(supabase, {
    usuario: user.id,
    accion: "crear_contacto",
    entidad: "contacto",
    entidad_id: data.id,
  });
  refresh();
  return { ok: true, id: data.id };
}

export async function actualizarContacto(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!uuid.safeParse(id).success) return { error: "Contacto no válido" };
  const parsed = contactoFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("contactos").update(parsed.data).eq("id", id);
  if (error) {
    if (error.code === UNIQUE_VIOLATION)
      return { error: "Ya existe otro contacto con ese teléfono" };
    log.error("actualizar contacto", { code: error.code, message: error.message });
    return { error: "No se han podido guardar los cambios" };
  }

  await registrarAuditoria(supabase, {
    usuario: user.id,
    accion: "editar_contacto",
    entidad: "contacto",
    entidad_id: id,
    detalle: { consentimiento: parsed.data.consentimiento },
  });
  refresh();
  return { ok: true };
}

/** Lista de exclusión: inmediata y permanente. */
export async function marcarNoLlamar(ids: string[]): Promise<FormState> {
  await getCurrentUser();
  const validos = z.array(uuid).min(1).max(1000).safeParse(ids);
  if (!validos.success) return { error: "Selección no válida" };

  const supabase = await createClient();
  for (const id of validos.data) {
    const { error } = await supabase.rpc("marcar_no_llamar", {
      p_contacto_id: id,
      p_origen: "panel",
    });
    if (error) {
      log.error("marcar no llamar", { code: error.code, message: error.message });
      return { error: "No se ha podido marcar algún contacto. Inténtalo de nuevo." };
    }
  }
  refresh();
  return { ok: true };
}

/**
 * Derecho de supresión (RGPD): borra el contacto y todo su historial, y sus
 * conversaciones en ElevenLabs. Si ElevenLabs falla, el borrado local sigue
 * adelante (no puede bloquearlo un tercero) y los IDs pendientes quedan en la
 * auditoría para borrarlos a mano (runbook).
 */
export async function borrarContacto(id: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!uuid.safeParse(id).success) return { error: "Contacto no válido" };

  const supabase = await createClient();
  const { data: llamadas } = await supabase
    .from("llamadas")
    .select("conversation_id")
    .eq("contacto_id", id);
  const conversaciones = (llamadas ?? [])
    .map((l) => l.conversation_id)
    .filter((c): c is string => Boolean(c));

  let pendientes: string[] = [];
  if (conversaciones.length) {
    if (isConfigured(elevenLabsEnv)) {
      const r = await Promise.allSettled(conversaciones.map((c) => borrarConversacion(c)));
      pendientes = conversaciones.filter((_, i) => r[i].status === "rejected");
    } else {
      pendientes = conversaciones;
    }
  }

  const { error } = await supabase.rpc("borrar_contacto_rgpd", { p_contacto_id: id });
  if (error) {
    log.error("borrar contacto", { code: error.code, message: error.message });
    return { error: "No se ha podido borrar el contacto" };
  }

  if (conversaciones.length)
    await registrarAuditoria(supabase, {
      usuario: user.id,
      accion: "borrar_conversaciones_elevenlabs",
      entidad: "contacto",
      entidad_id: id,
      detalle: { borradas: conversaciones.length - pendientes.length, pendientes },
    });
  if (pendientes.length)
    log.warn("conversaciones de ElevenLabs sin borrar", { contacto_id: id, pendientes });
  redirect("/contactos");
}

"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { despachar } from "@/lib/calls/dispatcher";
import { elevenLabsEnv, isConfigured } from "@/lib/env";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CrearLoteState =
  | { error: string }
  | { loteId: string; encolados: number; omitidos: Record<string, number> };

const crearSchema = z.object({
  ids: z.array(z.uuid()).min(1, "Selecciona algún contacto").max(5000, "Máximo 5.000 contactos por lote"),
  nombre: z.string().trim().max(120).optional(),
});

/** "Llamar a seleccionados": crea el lote y lanza la primera pasada. */
export async function crearLote(ids: string[], nombre?: string): Promise<CrearLoteState> {
  const user = await getCurrentUser();
  const parsed = crearSchema.safeParse({ ids: [...new Set(ids)], nombre });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!isConfigured(elevenLabsEnv)) {
    return { error: "El agente de voz todavía no está configurado (faltan las claves de ElevenLabs)." };
  }

  const supabase = await createClient();
  const { data: loteId, error } = await supabase.rpc("crear_lote", {
    p_contacto_ids: parsed.data.ids,
    p_nombre: parsed.data.nombre,
    p_creado_por: user.id,
  });
  if (error || !loteId) {
    log.error("crear lote", { code: error?.code, message: error?.message });
    return { error: "No se ha podido crear el lote." };
  }

  const { data: items } = await supabase.from("lote_items").select("estado, motivo_omision").eq("lote_id", loteId);
  const omitidos: Record<string, number> = {};
  let encolados = 0;
  for (const i of items ?? []) {
    if (i.estado === "en_cola") encolados++;
    else omitidos[i.motivo_omision ?? "otro"] = (omitidos[i.motivo_omision ?? "otro"] ?? 0) + 1;
  }
  const noEncontrados = parsed.data.ids.length - (items?.length ?? 0);
  if (noEncontrados > 0) omitidos.no_encontrado = noEncontrados;

  log.info("lote creado", { lote_id: loteId, encolados, omitidos: Object.values(omitidos).reduce((a, b) => a + b, 0) });
  after(() => despachar());
  refresh();
  return { loteId, encolados, omitidos };
}

const accionSchema = z.object({ loteId: z.uuid(), accion: z.enum(["pausar", "reanudar", "cancelar"]) });

/**
 * Pausar deja de lanzar llamadas nuevas (las que están sonando terminan);
 * cancelar además retira lo que quedaba en cola.
 */
export async function cambiarEstadoLote(loteId: string, accion: "pausar" | "reanudar" | "cancelar") {
  const user = await getCurrentUser();
  const parsed = accionSchema.safeParse({ loteId, accion });
  if (!parsed.success) return { error: "Acción no válida" };

  // RLS solo deja leer lotes: el cambio va con service role tras validar la sesión.
  const admin = createAdminClient();
  const [desde, hacia] =
    accion === "pausar"
      ? [["activo"], "pausado"]
      : accion === "reanudar"
        ? [["pausado"], "activo"]
        : [["activo", "pausado"], "cancelado"];
  const { data, error } = await admin
    .from("lotes")
    .update({ estado: hacia as "activo" | "pausado" | "cancelado" })
    .eq("id", loteId)
    .in("estado", desde as ("activo" | "pausado")[])
    .select("id");
  if (error) {
    log.error("cambiar estado de lote", { code: error.code, message: error.message });
    return { error: "No se ha podido actualizar el lote." };
  }
  if (!data.length) return { error: "El lote ya no está en un estado que permita esa acción." };

  if (accion === "cancelar") {
    const { error: errItems } = await admin
      .from("lote_items")
      .update({ estado: "omitido", motivo_omision: "lote_cancelado", proximo_intento_en: null })
      .eq("lote_id", loteId)
      .in("estado", ["en_cola", "esperando_reintento"]);
    if (errItems) log.error("cancelar items de lote", { code: errItems.code, message: errItems.message });
  }

  const supabase = await createClient();
  await registrarAuditoria(supabase, { usuario: user.id, accion: `${accion}_lote`, entidad: "lote", entidad_id: loteId });
  if (accion === "reanudar") after(() => despachar());
  refresh();
  return { ok: true };
}

"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { variablesLlamada } from "@/lib/calls/launch";
import { urlFirmadaConversacion } from "@/lib/elevenlabs/client";
import { getEmpresaActual } from "@/lib/empresa";
import { guionFormSchema, montarGuion, type GuionForm } from "@/lib/guion/guion";
import { COLUMNAS_GUION_LLAMADA } from "@/lib/guion/queries";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type GuardarGuionState = { ok?: boolean; error?: string; guionId?: string; version?: number };

const SOLO_PROPIETARIO = "Solo el propietario de la empresa puede cambiar el guion.";

/** Guarda una versión nueva del guion y, si se pide, la deja activa. */
export async function guardarGuion(datos: GuionForm, activar: boolean): Promise<GuardarGuionState> {
  const user = await getCurrentUser();
  const empresa = await getEmpresaActual();
  if (empresa.rol !== "propietario") return { error: SOLO_PROPIETARIO };

  const parsed = guionFormSchema.safeParse(datos);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const g = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guiones")
    .insert({
      empresa_id: empresa.id,
      // La numera la BD (trigger); el valor se ignora.
      version: 0,
      negocio_nombre: g.negocio_nombre,
      nombre_agente: g.nombre_agente,
      primer_mensaje: g.primer_mensaje,
      voz_id: g.voz_id,
      negocio: g.negocio,
      motivo: g.motivo,
      oferta: g.oferta,
      cita: g.cita,
      preguntas: g.preguntas,
      objeciones: g.objeciones,
      limites: g.limites,
      texto: montarGuion(g),
      creado_por: user.id,
    })
    .select("id, version")
    .single();
  if (error || !data) {
    log.error("guardar guion", { code: error?.code, message: error?.message });
    return { error: "No se ha podido guardar el guion." };
  }

  await registrarAuditoria(supabase, {
    usuario: user.id,
    empresa_id: empresa.id,
    accion: "crear_guion",
    entidad: "guion",
    entidad_id: data.id,
    detalle: { version: data.version },
  });

  if (activar) {
    const r = await activarGuion(data.id);
    if (r.error) return { ...r, guionId: data.id, version: data.version };
  }
  refresh();
  return { ok: true, guionId: data.id, version: data.version };
}

/** Deja activa una versión: la usarán las llamadas que se lancen a partir de ahora. */
export async function activarGuion(guionId: string): Promise<GuardarGuionState> {
  await getCurrentUser();
  const empresa = await getEmpresaActual();
  if (empresa.rol !== "propietario") return { error: SOLO_PROPIETARIO };
  if (!z.uuid().safeParse(guionId).success) return { error: "Versión no válida." };

  const supabase = await createClient();
  // Que sea de la empresa del panel (RLS deja ver todas las del usuario).
  const { data: guion } = await supabase
    .from("guiones")
    .select("id")
    .eq("id", guionId)
    .eq("empresa_id", empresa.id)
    .maybeSingle();
  if (!guion) return { error: "Esa versión no existe." };

  const { error } = await supabase.rpc("activar_guion", { p_guion_id: guionId });
  if (error) {
    log.error("activar guion", { code: error.code, message: error.message });
    return { error: "No se ha podido activar la versión." };
  }
  refresh();
  return { ok: true };
}

// --- Prueba en el navegador ---------------------------------------------------

export type IniciarPruebaState =
  | { error: string }
  | {
      llamadaId: string;
      signedUrl: string;
      variables: Record<string, string | number | boolean>;
      vozId: string | null;
    };

const MENSAJES_PRUEBA: Record<string, string> = {
  sin_guion: "Esa versión del guion no existe.",
  pausa_global: "Las llamadas están en pausa global: quítala para probar.",
  empresa_suspendida: "La cuenta de tu empresa está suspendida.",
  no_llamar: "Ese contacto ha pedido no ser llamado: elige otro.",
  llamada_activa: "Ese contacto ya tiene una llamada en curso. Espera a que termine o elige otro.",
  concurrencia: "Se ha alcanzado el máximo de llamadas simultáneas. Prueba en un momento.",
};

/**
 * Prepara una conversación de prueba con una versión del guion: crea la
 * llamada (marcada como prueba, para que las tools y el webhook la
 * encuentren) y pide a ElevenLabs una URL firmada. No marca ningún teléfono.
 * Cualquier miembro puede probar; solo el propietario edita.
 */
export async function iniciarPrueba(guionId: string, contactoId: string): Promise<IniciarPruebaState> {
  const user = await getCurrentUser();
  const empresa = await getEmpresaActual();
  if (!z.uuid().safeParse(guionId).success || !z.uuid().safeParse(contactoId).success) {
    return { error: "Elige una versión y un contacto." };
  }

  const supabase = await createClient();
  const [{ data: guion }, { data: contacto }] = await Promise.all([
    supabase.from("guiones").select(COLUMNAS_GUION_LLAMADA).eq("id", guionId).eq("empresa_id", empresa.id).maybeSingle(),
    supabase
      .from("contactos")
      .select("id, nombre, telefono, email")
      .eq("id", contactoId)
      .eq("empresa_id", empresa.id)
      .maybeSingle(),
  ]);
  if (!guion) return { error: MENSAJES_PRUEBA.sin_guion };
  if (!contacto) return { error: "Ese contacto no existe." };

  const { data: llamadaId, error } = await supabase.rpc("crear_llamada", {
    p_contacto_id: contacto.id,
    p_lanzada_por: user.id,
    p_guion_id: guionId,
    p_prueba: true,
  });
  if (error || !llamadaId) {
    const mensaje = error?.message && MENSAJES_PRUEBA[error.message];
    if (!mensaje) log.error("prueba: crear_llamada", { code: error?.code, message: error?.message });
    return { error: mensaje || "No se ha podido preparar la prueba." };
  }

  let signedUrl: string;
  try {
    signedUrl = await urlFirmadaConversacion();
  } catch (e) {
    await cerrarPruebaSinConversacion(llamadaId, `api: ${e instanceof Error ? e.message : String(e)}`);
    return { error: "El servicio de voz no responde. Inténtalo de nuevo en unos minutos." };
  }

  await registrarAuditoria(supabase, {
    usuario: user.id,
    empresa_id: empresa.id,
    accion: "probar_guion",
    entidad: "llamada",
    entidad_id: llamadaId,
    detalle: { guion_id: guionId },
  });

  return {
    llamadaId,
    signedUrl,
    variables: variablesLlamada({ llamadaId, contacto, guion, ahora: new Date() }),
    vozId: guion.voz_id,
  };
}

/**
 * Guarda el id de la conversación al conectar: el webhook post-llamada la
 * localiza por él y la cierra con la transcripción.
 */
export async function registrarConversacionPrueba(llamadaId: string, conversationId: string) {
  await getCurrentUser();
  const empresa = await getEmpresaActual();
  if (!z.uuid().safeParse(llamadaId).success || !/^[\w-]{1,100}$/.test(conversationId)) return;
  const { error } = await createAdminClient()
    .from("llamadas")
    .update({ conversation_id: conversationId })
    .eq("id", llamadaId)
    .eq("empresa_id", empresa.id)
    .eq("es_prueba", true)
    .is("conversation_id", null);
  if (error) log.warn("prueba: no se pudo guardar conversation_id", { llamada_id: llamadaId, code: error.code });
}

/** La conversación no llegó a empezar (micrófono denegado, error de red…): libera la llamada. */
export async function cancelarPrueba(llamadaId: string) {
  await getCurrentUser();
  const empresa = await getEmpresaActual();
  if (!z.uuid().safeParse(llamadaId).success) return;
  await cerrarPruebaSinConversacion(llamadaId, "prueba no iniciada", empresa.id);
}

async function cerrarPruebaSinConversacion(llamadaId: string, motivo: string, empresaId?: string) {
  let q = createAdminClient()
    .from("llamadas")
    .update({ estado: "fallida", motivo_fallo: motivo.slice(0, 300), finalizada_en: new Date().toISOString() })
    .eq("id", llamadaId)
    .eq("es_prueba", true)
    .in("estado", ["iniciada", "en_curso"])
    .is("conversation_id", null);
  if (empresaId) q = q.eq("empresa_id", empresaId);
  const { error } = await q;
  if (error) log.warn("prueba: no se pudo cerrar", { llamada_id: llamadaId, code: error.code });
}

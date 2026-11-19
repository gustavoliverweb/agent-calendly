import "server-only";
import { desconectarCalendly } from "@/lib/calendly/conectar";
import { olvidarConexionCalendly } from "@/lib/calendly/conexion";
import { olvidarDominios } from "@/lib/dominio/contexto";
import { borrarDominioRender } from "@/lib/dominio/render";
import { borrarConversacion } from "@/lib/elevenlabs/client";
import { empresaPrincipalId } from "@/lib/empresa";
import { elevenLabsAgenteEnv, isConfigured, renderEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { enParalelo, motivoNoBorrable, usoParaConservar } from "./baja-empresa-reglas";

export type ResultadoBaja =
  | { error: string }
  | {
      ok: true;
      /** Lo que no se pudo limpiar fuera de la app y hay que hacer a mano. */
      pendientes: { conversaciones: number; dominios: string[]; calendly: boolean };
      /** Emails de las cuentas que se han quedado sin ninguna empresa (no se borran solas). */
      sinEmpresa: string[];
    };

/**
 * Baja definitiva de una empresa (§ guía de alta, punto 6):
 * 1. Limpia lo que vive fuera de la BD: Calendly (webhook y autorización),
 *    dominios en Render, conversaciones en ElevenLabs e imágenes de marca.
 *    Un fallo de un tercero no bloquea la baja: queda como pendiente.
 * 2. Borra la empresa; la cascada se lleva todos sus datos (también su
 *    auditoría).
 * 3. Deja constancia en la auditoría de la plataforma (empresa_id nulo, así
 *    no cae en la cascada) con el uso mensual agregado, para facturar.
 * Es idempotente: si se corta a medias, se puede repetir.
 */
export async function borrarEmpresa(empresaId: string, confirmacion: string, adminId: string): Promise<ResultadoBaja> {
  const supabase = createAdminClient();
  const [{ data: empresa }, principal, enCurso] = await Promise.all([
    supabase.from("empresas").select("id, nombre, slug, estado").eq("id", empresaId).maybeSingle(),
    empresaPrincipalId(),
    supabase
      .from("llamadas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .in("estado", ["iniciada", "en_curso"]),
  ]);
  if (!empresa) return { error: "La empresa no existe." };
  const motivo = motivoNoBorrable({
    estado: empresa.estado,
    esPrincipal: empresa.id === principal,
    llamadasEnCurso: enCurso.count ?? 0,
    slug: empresa.slug,
    confirmacion,
  });
  if (motivo) return { error: motivo };

  // Lo que hay que conservar o limpiar, antes de que la cascada lo borre.
  const [equipo, dominios, uso, contadores, conversaciones] = await Promise.all([
    supabase.rpc("equipo_empresa", { p_empresa_id: empresaId }),
    supabase.from("dominios_empresa").select("dominio, render_id").eq("empresa_id", empresaId),
    supabase.rpc("uso_mensual", { p_empresa_id: empresaId, p_meses: 36 }),
    Promise.all(
      (["contactos", "llamadas", "lotes", "citas"] as const).map(async (t) => {
        const { count } = await supabase.from(t).select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
        return [t, count ?? 0] as const;
      }),
    ),
    idsConversaciones(empresaId).catch(() => null),
  ]);
  if (equipo.error || dominios.error || uso.error || !conversaciones) {
    log.error("preparar baja de empresa", {
      empresa_id: empresaId,
      error: equipo.error?.message ?? dominios.error?.message ?? uso.error?.message ?? "conversaciones",
    });
    return { error: "No se han podido leer los datos de la empresa. No se ha borrado nada." };
  }

  // 1. Fuera de la BD.
  let calendlyPendiente = false;
  try {
    await desconectarCalendly(empresaId, adminId);
  } catch (e) {
    calendlyPendiente = true;
    log.warn("baja de empresa: Calendly sin desconectar", { empresa_id: empresaId, error: String(e) });
  }

  const conRender = (dominios.data ?? []).filter((d) => d.render_id);
  const dominiosPendientes = isConfigured(renderEnv)
    ? await enParalelo(conRender.map((d) => d.dominio), 3, borrarDominioRender)
    : conRender.map((d) => d.dominio);

  const conversacionesPendientes = isConfigured(elevenLabsAgenteEnv)
    ? await enParalelo(conversaciones, 8, borrarConversacion)
    : conversaciones;

  const { data: imagenes } = await supabase.storage.from("marca").list(empresaId, { limit: 1000 });
  if (imagenes?.length) {
    const { error } = await supabase.storage.from("marca").remove(imagenes.map((i) => `${empresaId}/${i.name}`));
    if (error) log.warn("baja de empresa: imágenes de marca sin borrar", { empresa_id: empresaId, message: error.message });
  }

  // 2. La empresa y, en cascada, todos sus datos.
  const { error } = await supabase.from("empresas").delete().eq("id", empresaId);
  if (error) {
    log.error("borrar empresa", { empresa_id: empresaId, code: error.code, message: error.message });
    return { error: "No se ha podido borrar la empresa. Lo externo ya está limpio: vuelve a intentarlo." };
  }
  olvidarDominios();
  olvidarConexionCalendly(empresaId);

  // Cuentas que se han quedado sin empresa (ni son administradoras).
  const miembros = equipo.data ?? [];
  const ids = miembros.map((m) => m.usuario_id);
  const [conOtra, admins] = ids.length
    ? await Promise.all([
        supabase.from("miembros").select("usuario_id").in("usuario_id", ids),
        supabase.from("admins_plataforma").select("usuario_id").in("usuario_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const siguen = new Set([...(conOtra.data ?? []), ...(admins.data ?? [])].map((f) => f.usuario_id));
  const sinEmpresa = miembros.filter((m) => !siguen.has(m.usuario_id)).map((m) => m.email);

  const pendientes = {
    conversaciones: conversacionesPendientes.length,
    dominios: dominiosPendientes,
    calendly: calendlyPendiente,
  };
  const { error: errAuditoria } = await supabase.from("auditoria").insert({
    usuario: adminId,
    empresa_id: null,
    accion: "borrar_empresa",
    entidad: "empresa",
    entidad_id: empresaId,
    detalle: {
      nombre: empresa.nombre,
      slug: empresa.slug,
      borrados: { ...Object.fromEntries(contadores), miembros: miembros.length, conversaciones: conversaciones.length },
      uso_mensual: usoParaConservar(uso.data ?? []),
      cuentas_sin_empresa: sinEmpresa.length,
      pendientes: { ...pendientes, conversaciones: conversacionesPendientes },
    },
  });
  if (errAuditoria) log.error("baja de empresa sin auditar", { empresa_id: empresaId, code: errAuditoria.code });
  log.warn("empresa borrada", { empresa_id: empresaId, slug: empresa.slug, por: adminId, pendientes: pendientes });

  return { ok: true, pendientes, sinEmpresa };
}

/** IDs de conversación de ElevenLabs de todas las llamadas de la empresa (por páginas). */
async function idsConversaciones(empresaId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const ids: string[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("llamadas")
      .select("conversation_id")
      .eq("empresa_id", empresaId)
      .not("conversation_id", "is", null)
      .order("id")
      .range(desde, desde + 999);
    if (error) throw new Error(`leer conversaciones: ${error.message}`);
    ids.push(...data.map((l) => l.conversation_id!).filter(Boolean));
    if (data.length < 1000) return ids;
  }
}

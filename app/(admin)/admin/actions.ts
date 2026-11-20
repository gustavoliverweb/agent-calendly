"use server";

import { refresh, updateTag } from "next/cache";
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
import { borrarEmpresa, type ResultadoBaja } from "@/lib/baja-empresa";
import { olvidarDominios } from "@/lib/dominio/contexto";
import {
  formatoImagen,
  MAX_BYTES_IMAGEN,
  marcaPlataformaSchema,
  TIPOS_IMAGEN,
  type MarcaPlataformaForm,
  type TipoImagen,
} from "@/lib/dominio/marca-form";
import { TAG_MARCA_PLATAFORMA } from "@/lib/marca";
import { validarDominioPropio } from "@/lib/dominio/hosts";
import { anadirDominioRender, borrarDominioRender, comprobarDns, RenderError, verificarDominioRender } from "@/lib/dominio/render";
import { buscarVoces, ElevenLabsError, obtenerVoz, type VozElevenLabs } from "@/lib/elevenlabs/client";
import { elevenLabsAgenteEnv, isConfigured, renderEnv } from "@/lib/env";
import { VOICE_ID } from "@/lib/guion/guion";
import { usoDeVoces } from "@/lib/voces";
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

/**
 * Baja definitiva. Solo con la empresa suspendida y escribiendo su
 * identificador; los detalles y comprobaciones están en lib/baja-empresa.ts.
 */
export async function borrarEmpresaAdmin(empresaId: string, confirmacion: string): Promise<ResultadoBaja> {
  const admin = await requireAdminPlataforma();
  const datos = z.object({ empresaId: z.uuid(), confirmacion: z.string().max(100) }).safeParse({ empresaId, confirmacion });
  if (!datos.success) return { error: "Datos no válidos" };
  // Sin refresh(): la ficha ya no existe; el cliente vuelve a /admin.
  return borrarEmpresa(datos.data.empresaId, datos.data.confirmacion, admin.id);
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

// --- Línea y límites (S5) ---------------------------------------------------------

const lineaSchema = z.object({
  empresaId: z.uuid(),
  phoneNumberId: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || null),
  telefonoNumero: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v || null),
  limiteMinutos: z.number().int("Minutos: número entero").min(1, "Minutos: mínimo 1").max(1_000_000).nullable(),
  maxConcurrencia: z.number().int().min(1, "Llamadas simultáneas: mínimo 1").max(50, "Llamadas simultáneas: máximo 50"),
  precioMinuto: z
    .number("Tarifa: escribe un número, p. ej. 0,25")
    .min(0, "Tarifa: no puede ser negativa")
    .max(1000, "Tarifa: máximo 1.000 € por minuto")
    .refine((v) => Math.abs(v * 10_000 - Math.round(v * 10_000)) < 1e-6, "Tarifa: como mucho 4 decimales")
    .nullable(),
});

export type LineaLimites = z.input<typeof lineaSchema>;

/** Asigna la línea (número importado en ElevenLabs), los límites contratados y la tarifa por minuto de una empresa. */
export async function guardarLineaYLimites(datos: LineaLimites): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  const parsed = lineaSchema.safeParse(datos);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const { error } = await createAdminClient()
    .from("empresas")
    .update({
      phone_number_id: d.phoneNumberId,
      telefono_numero: d.phoneNumberId ? d.telefonoNumero : null,
      limite_minutos_mes: d.limiteMinutos,
      max_concurrencia_contratada: d.maxConcurrencia,
      precio_minuto: d.precioMinuto,
    })
    .eq("id", d.empresaId);
  if (error?.code === UNIQUE_VIOLATION) return { error: "Ese número ya está asignado a otra empresa." };
  if (error) {
    log.error("guardar línea y límites", { code: error.code, message: error.message });
    return { error: "No se han podido guardar la línea, los límites y la tarifa." };
  }
  await auditar(admin.id, d.empresaId, "cambiar_linea_limites", "empresa", {
    linea: Boolean(d.phoneNumberId),
    limite_minutos_mes: d.limiteMinutos,
    max_concurrencia_contratada: d.maxConcurrencia,
    precio_minuto: d.precioMinuto,
  });
  refresh();
  return {};
}

/** Conversaciones simultáneas que permite el plan de ElevenLabs, para toda la plataforma. */
export async function guardarConcurrenciaGlobal(maximo: number): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  const parsed = z.number().int().min(1, "Mínimo 1").max(500, "Máximo 500").safeParse(maximo);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await createAdminClient()
    .from("ajustes_plataforma")
    .update({ max_concurrencia_global: parsed.data })
    .eq("id", true);
  if (error) {
    log.error("guardar concurrencia global", { code: error.code });
    return { error: "No se ha podido guardar." };
  }
  log.warn("concurrencia global cambiada", { maximo: parsed.data, por: admin.id });
  refresh();
  return {};
}

// --- Dominios propios (marca blanca) -------------------------------------------

async function resultadoRender(dominio: string): Promise<{ estado: "pendiente" | "verificado" | "error"; render_id?: string; detalle: string }> {
  if (!isConfigured(renderEnv)) {
    const dns = await comprobarDns(dominio);
    return dns.ok
      ? { estado: "verificado", detalle: `${dns.detalle}. Sin API de Render: comprueba allí que el dominio está añadido y con certificado.` }
      : { estado: "pendiente", detalle: `Añádelo en Render (Settings → Custom Domains). ${dns.detalle}` };
  }
  try {
    const r = await anadirDominioRender(dominio);
    if (r.verificado) return { estado: "verificado", render_id: r.id, detalle: "Render lo sirve con HTTPS." };
    await verificarDominioRender(dominio).catch(() => undefined);
    const dns = await comprobarDns(dominio);
    return { estado: "pendiente", render_id: r.id, detalle: `Render aún no lo ha verificado. ${dns.detalle}` };
  } catch (e) {
    return { estado: "error", detalle: e instanceof RenderError ? `Render: ${e.message}` : "No se pudo contactar con Render." };
  }
}

/** Da de alta un dominio propio de la empresa (y en Render, si hay API). */
export async function anadirDominio(empresaId: string, valor: string): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  if (!z.uuid().safeParse(empresaId).success) return { error: "Empresa no válida." };
  const v = validarDominioPropio(valor);
  if ("error" in v) return { error: v.error };

  const supabase = createAdminClient();
  const { data: fila, error } = await supabase
    .from("dominios_empresa")
    .insert({ empresa_id: empresaId, dominio: v.dominio })
    .select("id")
    .single();
  if (error?.code === UNIQUE_VIOLATION) return { error: "Ese dominio ya está asignado." };
  if (error || !fila) {
    log.error("añadir dominio", { code: error?.code });
    return { error: "No se ha podido añadir el dominio." };
  }
  const r = await resultadoRender(v.dominio);
  await supabase.from("dominios_empresa").update({ ...r, comprobado_en: new Date().toISOString() }).eq("id", fila.id);
  olvidarDominios();
  await auditar(admin.id, empresaId, "anadir_dominio", "empresa", { dominio: v.dominio, estado: r.estado });
  refresh();
  return {};
}

/** Vuelve a comprobar el DNS y el certificado de un dominio. */
export async function comprobarDominio(id: string): Promise<{ error?: string; estado?: string }> {
  await requireAdminPlataforma();
  if (!z.uuid().safeParse(id).success) return { error: "Dominio no válido." };
  const supabase = createAdminClient();
  const { data: fila } = await supabase.from("dominios_empresa").select("dominio").eq("id", id).maybeSingle();
  if (!fila) return { error: "Dominio no encontrado." };
  const r = await resultadoRender(fila.dominio);
  await supabase.from("dominios_empresa").update({ ...r, comprobado_en: new Date().toISOString() }).eq("id", id);
  olvidarDominios();
  refresh();
  return { estado: r.estado };
}

/** Quita un dominio de la empresa (y de Render, si hay API). Sus usuarios siguen entrando por las otras direcciones. */
export async function quitarDominio(id: string): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  if (!z.uuid().safeParse(id).success) return { error: "Dominio no válido." };
  const supabase = createAdminClient();
  const { data: fila } = await supabase.from("dominios_empresa").select("dominio, empresa_id, render_id").eq("id", id).maybeSingle();
  if (!fila) return { error: "Dominio no encontrado." };
  if (fila.render_id && isConfigured(renderEnv)) {
    try {
      await borrarDominioRender(fila.dominio);
    } catch (e) {
      return { error: e instanceof RenderError ? `Render: ${e.message}` : "No se pudo quitar de Render." };
    }
  }
  const { error } = await supabase.from("dominios_empresa").delete().eq("id", id);
  if (error) return { error: "No se ha podido quitar el dominio." };
  olvidarDominios();
  await auditar(admin.id, fila.empresa_id, "quitar_dominio", "empresa", { dominio: fila.dominio });
  refresh();
  return {};
}

// --- Modo B2B -------------------------------------------------------------------

/**
 * Permite (o no) campañas B2B a una empresa. Al retirarlo, si la empresa
 * estaba en B2B pasa a comercial (la opción más restrictiva): sus lotes
 * siguen, pero ya exigen consentimiento.
 */
export async function cambiarB2b(empresaId: string, habilitado: boolean): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  if (!z.uuid().safeParse(empresaId).success) return { error: "Empresa no válida." };
  const supabase = createAdminClient();
  if (!habilitado) {
    const { error } = await supabase
      .from("configuracion")
      .update({ tipo_campana: "comercial" })
      .eq("empresa_id", empresaId)
      .eq("tipo_campana", "b2b");
    if (error) return { error: "No se ha podido cambiar el tipo de campaña de la empresa." };
  }
  const { error } = await supabase.from("empresas").update({ b2b_habilitado: habilitado === true }).eq("id", empresaId);
  if (error) return { error: "No se ha podido guardar." };
  await auditar(admin.id, empresaId, habilitado ? "habilitar_b2b" : "deshabilitar_b2b", "empresa");
  refresh();
  return {};
}

// --- Solicitudes de la web -------------------------------------------------------

export async function cambiarEstadoSolicitud(id: string, estado: "nueva" | "atendida" | "descartada"): Promise<{ error?: string }> {
  await requireAdminPlataforma();
  if (!z.uuid().safeParse(id).success || !["nueva", "atendida", "descartada"].includes(estado)) {
    return { error: "Solicitud no válida." };
  }
  const { error } = await createAdminClient().from("solicitudes_contacto").update({ estado }).eq("id", id);
  if (error) return { error: "No se ha podido cambiar el estado." };
  refresh();
  return {};
}

// --- Catálogo de voces -----------------------------------------------------------

const SIN_PERMISO_VOCES =
  "La clave de la API de ElevenLabs no tiene permiso para leer voces. En ElevenLabs → API keys, edita la clave y activa Voices → Read.";

const errorVoces = (e: unknown, porDefecto: string) =>
  e instanceof ElevenLabsError && e.status === 401 ? SIN_PERMISO_VOCES : porDefecto;

const textoVoz = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre").max(60, "Nombre: máximo 60 caracteres"),
  descripcion: z.string().trim().max(200, "Descripción: máximo 200 caracteres"),
});

/** Voces de la cuenta de ElevenLabs, para elegir cuál añadir al catálogo. */
export async function buscarVocesElevenLabs(
  busqueda: string,
  pagina?: string,
): Promise<{ voces: VozElevenLabs[]; siguiente: string | null } | { error: string }> {
  await requireAdminPlataforma();
  if (!isConfigured(elevenLabsAgenteEnv)) return { error: "ElevenLabs no está configurado." };
  try {
    return await buscarVoces(String(busqueda ?? ""), typeof pagina === "string" ? pagina.slice(0, 500) : undefined);
  } catch (e) {
    return { error: errorVoces(e, "No se ha podido leer la lista de voces de ElevenLabs.") };
  }
}

/** Añade una voz de la cuenta de ElevenLabs al catálogo que ven las empresas. */
export async function anadirVoz(voiceId: string, nombre: string, descripcion: string): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  const datos = textoVoz.extend({ voiceId: z.string().regex(VOICE_ID, "Voz no válida") }).safeParse({ voiceId, nombre, descripcion });
  if (!datos.success) return { error: datos.error.issues[0].message };

  let voz: VozElevenLabs | null;
  try {
    voz = await obtenerVoz(datos.data.voiceId);
  } catch (e) {
    return { error: errorVoces(e, "No se ha podido comprobar la voz en ElevenLabs.") };
  }
  if (!voz) return { error: "Esa voz no está en la cuenta de ElevenLabs." };

  const { error } = await createAdminClient().from("voces").insert({
    voice_id: voz.voiceId,
    nombre: datos.data.nombre,
    descripcion: datos.data.descripcion,
    muestra_url: voz.muestraUrl?.startsWith("https://") ? voz.muestraUrl.slice(0, 1000) : null,
  });
  if (error?.code === UNIQUE_VIOLATION) return { error: "Esa voz ya está en el catálogo." };
  if (error) {
    log.error("añadir voz", { code: error.code, message: error.message });
    return { error: "No se ha podido añadir la voz." };
  }
  log.info("voz añadida al catálogo", { voice_id: voz.voiceId, por: admin.id });
  refresh();
  return {};
}

export async function editarVoz(id: string, nombre: string, descripcion: string): Promise<{ error?: string }> {
  await requireAdminPlataforma();
  const datos = textoVoz.extend({ id: z.uuid() }).safeParse({ id, nombre, descripcion });
  if (!datos.success) return { error: datos.error.issues[0].message };
  const { error } = await createAdminClient()
    .from("voces")
    .update({ nombre: datos.data.nombre, descripcion: datos.data.descripcion })
    .eq("id", datos.data.id);
  if (error) return { error: "No se ha podido guardar." };
  refresh();
  return {};
}

/** Ofrecer o dejar de ofrecer una voz. Los guiones que ya la usan siguen igual. */
export async function cambiarVozActiva(id: string, activa: boolean): Promise<{ error?: string }> {
  await requireAdminPlataforma();
  if (!z.uuid().safeParse(id).success) return { error: "Voz no válida." };
  const { error } = await createAdminClient().from("voces").update({ activa: activa === true }).eq("id", id);
  if (error) return { error: "No se ha podido cambiar." };
  refresh();
  return {};
}

/** Quita una voz del catálogo, si ninguna empresa la tiene en su guion activo. */
export async function quitarVoz(id: string): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  if (!z.uuid().safeParse(id).success) return { error: "Voz no válida." };
  const supabase = createAdminClient();
  const { data: voz } = await supabase.from("voces").select("voice_id").eq("id", id).maybeSingle();
  if (!voz) return { error: "Voz no encontrada." };
  const enUso = (await usoDeVoces()).get(voz.voice_id) ?? 0;
  if (enUso > 0) {
    return {
      error: `La usa${enUso === 1 ? " 1 empresa" : `n ${enUso} empresas`} en su guion activo. Desactívala para que no la elijan más.`,
    };
  }
  const { error } = await supabase.from("voces").delete().eq("id", id);
  if (error) return { error: "No se ha podido quitar." };
  log.info("voz quitada del catálogo", { voice_id: voz.voice_id, por: admin.id });
  refresh();
  return {};
}

// --- Marca de la plataforma ---------------------------------------------------------

/** Nombre, descripción y email de contacto de la plataforma (vacío = por defecto). */
export async function guardarMarcaPlataforma(datos: MarcaPlataformaForm): Promise<{ error?: string }> {
  const admin = await requireAdminPlataforma();
  const parsed = marcaPlataformaSchema.safeParse(datos);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const { error } = await createAdminClient()
    .from("ajustes_plataforma")
    .update({ marca_nombre: d.nombre, marca_descripcion: d.descripcion, marca_email: d.email })
    .eq("id", true);
  if (error) {
    log.error("guardar marca de la plataforma", { code: error.code, message: error.message });
    return { error: "No se ha podido guardar la marca." };
  }
  log.warn("marca de la plataforma cambiada", { por: admin.id });
  updateTag(TAG_MARCA_PLATAFORMA);
  refresh();
  return {};
}

const RUTA_IMAGEN_PLATAFORMA = "plataforma";
const COLUMNA_PLATAFORMA = { logo: "marca_logo", favicon: "marca_favicon" } as const;

export async function subirImagenPlataforma(formData: FormData): Promise<{ error?: string }> {
  await requireAdminPlataforma();
  const tipo = formData.get("tipo");
  const archivo = formData.get("archivo");
  if (!TIPOS_IMAGEN.includes(tipo as TipoImagen)) return { error: "Tipo de imagen no válido." };
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige una imagen." };
  if (archivo.size > MAX_BYTES_IMAGEN) return { error: "La imagen no puede pasar de 512 KB." };
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const formato = formatoImagen(bytes);
  if (!formato) return { error: "Formato no admitido: usa PNG, JPG o WebP." };

  const t = tipo as TipoImagen;
  const supabase = createAdminClient();
  const { data: actual } = await supabase.from("ajustes_plataforma").select("marca_logo, marca_favicon").eq("id", true).single();
  // Nombre nuevo en cada subida: la URL pública cambia y ningún navegador ve la antigua en caché.
  const ruta = `${RUTA_IMAGEN_PLATAFORMA}/${t}-${Date.now()}.${formato.extension}`;
  const { error: errSubida } = await supabase.storage
    .from("marca")
    .upload(ruta, bytes, { contentType: formato.tipo, cacheControl: "31536000", upsert: false });
  if (errSubida) {
    log.error("subir imagen de la plataforma", { message: errSubida.message });
    return { error: "No se ha podido subir la imagen." };
  }
  const { error } = await supabase
    .from("ajustes_plataforma")
    .update(t === "logo" ? { marca_logo: ruta } : { marca_favicon: ruta })
    .eq("id", true);
  if (error) {
    await supabase.storage.from("marca").remove([ruta]);
    return { error: "No se ha podido guardar la imagen." };
  }
  const anterior = actual?.[COLUMNA_PLATAFORMA[t]];
  if (anterior) await supabase.storage.from("marca").remove([anterior]);
  updateTag(TAG_MARCA_PLATAFORMA);
  refresh();
  return {};
}

export async function quitarImagenPlataforma(tipo: TipoImagen): Promise<{ error?: string }> {
  await requireAdminPlataforma();
  if (!TIPOS_IMAGEN.includes(tipo)) return { error: "Tipo de imagen no válido." };
  const supabase = createAdminClient();
  const { data: actual } = await supabase.from("ajustes_plataforma").select("marca_logo, marca_favicon").eq("id", true).single();
  const { error } = await supabase
    .from("ajustes_plataforma")
    .update(tipo === "logo" ? { marca_logo: null } : { marca_favicon: null })
    .eq("id", true);
  if (error) return { error: "No se ha podido quitar la imagen." };
  const anterior = actual?.[COLUMNA_PLATAFORMA[tipo]];
  if (anterior) await supabase.storage.from("marca").remove([anterior]);
  updateTag(TAG_MARCA_PLATAFORMA);
  refresh();
  return {};
}

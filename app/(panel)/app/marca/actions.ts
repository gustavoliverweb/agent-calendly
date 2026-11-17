"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { formatoImagen, MAX_BYTES_IMAGEN, marcaFormSchema, TIPOS_IMAGEN, type MarcaForm, type TipoImagen } from "@/lib/dominio/marca-form";
import { getEmpresaActual } from "@/lib/empresa";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SOLO_PROPIETARIO = "Solo el propietario de la empresa puede cambiar la marca.";
const COLUMNA: Record<TipoImagen, "marca_logo" | "marca_favicon"> = { logo: "marca_logo", favicon: "marca_favicon" };

/**
 * La tabla empresas no admite escrituras con la sesión del usuario: tras
 * comprobar que es propietario, se escribe con service role y solo en su empresa.
 */
async function propietario() {
  const [user, empresa] = await Promise.all([getCurrentUser(), getEmpresaActual()]);
  return empresa.rol === "propietario" ? { user, empresa } : null;
}

export async function guardarMarca(datos: MarcaForm): Promise<{ error?: string }> {
  const quien = await propietario();
  if (!quien) return { error: SOLO_PROPIETARIO };
  const parsed = marcaFormSchema.safeParse(datos);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const { error } = await createAdminClient()
    .from("empresas")
    .update({
      marca_nombre: d.nombre,
      marca_color: d.color,
      legal_razon_social: d.razonSocial,
      legal_nif: d.nif,
      legal_domicilio: d.domicilio,
      legal_registro: d.registro,
      legal_email: d.email,
    })
    .eq("id", quien.empresa.id);
  if (error) {
    log.error("guardar marca", { code: error.code, message: error.message });
    return { error: "No se ha podido guardar la marca." };
  }
  await registrarAuditoria(await createClient(), {
    usuario: quien.user.id,
    empresa_id: quien.empresa.id,
    accion: "cambiar_marca",
    entidad: "empresa",
    entidad_id: quien.empresa.id,
  });
  refresh();
  return {};
}

export async function subirImagenMarca(formData: FormData): Promise<{ error?: string }> {
  const quien = await propietario();
  if (!quien) return { error: SOLO_PROPIETARIO };
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
  const { data: actual } = await supabase.from("empresas").select("marca_logo, marca_favicon").eq("id", quien.empresa.id).single();
  // Nombre nuevo en cada subida: la URL pública cambia y ningún navegador ve la antigua en caché.
  const ruta = `${quien.empresa.id}/${t}-${Date.now()}.${formato.extension}`;
  const { error: errSubida } = await supabase.storage
    .from("marca")
    .upload(ruta, bytes, { contentType: formato.tipo, cacheControl: "31536000", upsert: false });
  if (errSubida) {
    log.error("subir imagen de marca", { message: errSubida.message });
    return { error: "No se ha podido subir la imagen." };
  }
  const { error } = await supabase.from("empresas").update(t === "logo" ? { marca_logo: ruta } : { marca_favicon: ruta }).eq("id", quien.empresa.id);
  if (error) {
    await supabase.storage.from("marca").remove([ruta]);
    return { error: "No se ha podido guardar la imagen." };
  }
  const anterior = actual?.[COLUMNA[t]];
  if (anterior) await supabase.storage.from("marca").remove([anterior]);
  refresh();
  return {};
}

export async function quitarImagenMarca(tipo: TipoImagen): Promise<{ error?: string }> {
  const quien = await propietario();
  if (!quien) return { error: SOLO_PROPIETARIO };
  if (!TIPOS_IMAGEN.includes(tipo)) return { error: "Tipo de imagen no válido." };
  const supabase = createAdminClient();
  const { data: actual } = await supabase.from("empresas").select("marca_logo, marca_favicon").eq("id", quien.empresa.id).single();
  const { error } = await supabase.from("empresas").update(tipo === "logo" ? { marca_logo: null } : { marca_favicon: null }).eq("id", quien.empresa.id);
  if (error) return { error: "No se ha podido quitar la imagen." };
  const anterior = actual?.[COLUMNA[tipo]];
  if (anterior) await supabase.storage.from("marca").remove([anterior]);
  refresh();
  return {};
}

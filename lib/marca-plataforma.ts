import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { urlImagenMarca } from "@/lib/dominio/imagen";
import { log } from "@/lib/log";
import { MARCA_POR_DEFECTO, TAG_MARCA_PLATAFORMA, type MarcaPlataforma } from "@/lib/marca";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Marca vigente de la plataforma (/admin → Marca), con los valores por
 * defecto donde no se haya cambiado nada.
 *
 * En caché para que la web pública siga siendo estática: se invalida al
 * guardar (updateTag) y, por si acaso, se renueva cada hora. Si la base de
 * datos no responde (por ejemplo, durante el build) se usan los valores por
 * defecto, como mucho durante esa hora.
 */
export async function marcaPlataforma(): Promise<MarcaPlataforma> {
  "use cache";
  cacheTag(TAG_MARCA_PLATAFORMA);
  cacheLife("hours");
  try {
    const { data, error } = await createAdminClient()
      .from("ajustes_plataforma")
      .select("marca_nombre, marca_descripcion, marca_email, marca_logo, marca_favicon")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const email = data?.marca_email ?? MARCA_POR_DEFECTO.email;
    return {
      nombre: data?.marca_nombre ?? MARCA_POR_DEFECTO.nombre,
      descripcion: data?.marca_descripcion ?? MARCA_POR_DEFECTO.descripcion,
      email,
      logoUrl: urlImagenMarca(data?.marca_logo ?? null),
      faviconUrl: urlImagenMarca(data?.marca_favicon ?? null),
      emailProvisional: email === MARCA_POR_DEFECTO.email,
    };
  } catch (e) {
    log.warn("marca de la plataforma por defecto", { error: String(e) });
    return { ...MARCA_POR_DEFECTO, logoUrl: null, faviconUrl: null, emailProvisional: true };
  }
}

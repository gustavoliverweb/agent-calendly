import "server-only";
import { empresaPrincipalId } from "@/lib/empresa";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Línea con la que llama una empresa (S5): su número importado en ElevenLabs,
 * que asigna el proveedor desde /admin.
 *
 * Transitorio: la empresa principal sin número asignado usa el de la variable
 * ELEVENLABS_PHONE_NUMBER_ID, como antes de la S5.
 */
export type LineaEmpresa = { phoneNumberId: string; numero: string | null; origen: "empresa" | "entorno" };

export async function lineaDeEmpresa(empresaId: string): Promise<LineaEmpresa | null> {
  const { data, error } = await createAdminClient()
    .from("empresas")
    .select("phone_number_id, telefono_numero")
    .eq("id", empresaId)
    .maybeSingle();
  if (error) {
    log.error("leer línea de la empresa", { empresa_id: empresaId, code: error.code });
    return null;
  }
  if (data?.phone_number_id) {
    return { phoneNumberId: data.phone_number_id, numero: data.telefono_numero, origen: "empresa" };
  }
  const deEntorno = process.env.ELEVENLABS_PHONE_NUMBER_ID?.replace(/\s+#.*$/, "").trim();
  if (deEntorno && empresaId === (await empresaPrincipalId())) {
    return { phoneNumberId: deEntorno, numero: null, origen: "entorno" };
  }
  return null;
}

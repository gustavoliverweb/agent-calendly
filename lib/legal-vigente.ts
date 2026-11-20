import "server-only";
import { TITULAR, type CampoTitular } from "@/lib/legal";
import { marcaPlataforma } from "@/lib/marca-plataforma";

/** Datos del titular con el email de contacto de la marca cuando no hay uno propio. */
export async function titularVigente(): Promise<Record<CampoTitular, string | null>> {
  if (TITULAR.email) return TITULAR;
  const marca = await marcaPlataforma();
  return { ...TITULAR, email: marca.emailProvisional ? null : marca.email };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generarCsv } from "@/lib/contacts/csv";
import { appEnv, isConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { claveMes, filaDetalleCsv, filaResumenCsv, type LlamadaMes, type Mes } from "./calculo";

/** PostgREST devuelve como mucho 1.000 filas por petición. */
const PAGINA = 1000;
/** Tope de seguridad del detalle (≈ 100 llamadas al día dan unas 3.000 al mes). */
const MAX_FILAS = 50_000;

/** Coste por minuto de ElevenLabs (USD) que paga el proveedor, para estimar el margen. */
export function costeMinutoUsd(): number {
  return isConfigured(appEnv) ? appEnv().COSTE_MINUTO_ESTIMADO : 0.12;
}

/**
 * Detalle de las llamadas de una empresa en un mes, sin datos personales.
 * Con la sesión del usuario (panel) la BD comprueba que es miembro; con el
 * cliente de servicio, es el proveedor desde /admin.
 */
export async function csvDetalle(supabase: SupabaseClient<Database>, empresaId: string, mes: Mes): Promise<string> {
  const filas: LlamadaMes[] = [];
  for (let desde = 0; desde < MAX_FILAS; desde += PAGINA) {
    const { data, error } = await supabase
      .rpc("llamadas_del_mes", { p_empresa_id: empresaId, p_mes: mes })
      .range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`detalle del mes: ${error.message}`);
    filas.push(...data);
    if (data.length < PAGINA) break;
  }
  return generarCsv(filas.map(filaDetalleCsv));
}

/** Resumen de facturación de todas las empresas en un mes (solo /admin). */
export async function csvPlataforma(mes: Mes): Promise<string> {
  const { data, error } = await createAdminClient().rpc("uso_plataforma", { p_mes: mes });
  if (error) throw new Error(`uso de la plataforma: ${error.message}`);
  const coste = costeMinutoUsd();
  return generarCsv(data.map((f) => filaResumenCsv(mes, f, coste)));
}

export function respuestaCsv(nombre: string, contenido: string): Response {
  return new Response(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export const nombreCsv = (prefijo: string, mes: Mes) => `${prefijo}-${claveMes(mes)}.csv`;

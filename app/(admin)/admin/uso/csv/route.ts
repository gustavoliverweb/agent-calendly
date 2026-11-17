import type { NextRequest } from "next/server";
import { esAdminPlataforma } from "@/lib/admin";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { leerMes } from "@/lib/uso/calculo";
import { csvDetalle, csvPlataforma, nombreCsv, respuestaCsv } from "@/lib/uso/consultas";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Exportación para facturar (?mes=AAAA-MM): resumen de todas las empresas o,
 * con ?empresa=<id>, el detalle de sus llamadas (sin datos personales).
 */
export async function GET(request: NextRequest) {
  // 404 a quien no es administrador, como las páginas de /admin.
  if (!(await esAdminPlataforma())) return new Response("Not Found", { status: 404 });
  const params = request.nextUrl.searchParams;
  const mes = leerMes(params.get("mes"), new Date());
  const empresaId = params.get("empresa");
  try {
    if (empresaId) {
      if (!UUID.test(empresaId)) return new Response("Empresa no válida", { status: 400 });
      const supabase = createAdminClient();
      const { data: empresa } = await supabase.from("empresas").select("slug").eq("id", empresaId).maybeSingle();
      if (!empresa) return new Response("Not Found", { status: 404 });
      return respuestaCsv(nombreCsv(`llamadas-${empresa.slug}`, mes), await csvDetalle(supabase, empresaId, mes));
    }
    return respuestaCsv(nombreCsv("uso-empresas", mes), await csvPlataforma(mes));
  } catch (e) {
    log.error("exportar uso de la plataforma", { error: String(e) });
    return new Response("No se ha podido generar el CSV.", { status: 500 });
  }
}

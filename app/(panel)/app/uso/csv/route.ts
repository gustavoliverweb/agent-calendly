import type { NextRequest } from "next/server";
import { getEmpresaActual } from "@/lib/empresa";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { leerMes } from "@/lib/uso/calculo";
import { csvDetalle, nombreCsv, respuestaCsv } from "@/lib/uso/consultas";

/** Detalle de las llamadas de un mes de la empresa (?mes=AAAA-MM), sin datos personales. */
export async function GET(request: NextRequest) {
  const empresa = await getEmpresaActual();
  const mes = leerMes(request.nextUrl.searchParams.get("mes"), new Date());
  try {
    // Con la sesión del usuario: la BD comprueba que es miembro.
    const csv = await csvDetalle(await createClient(), empresa.id, mes);
    return respuestaCsv(nombreCsv(`llamadas-${empresa.slug}`, mes), csv);
  } catch (e) {
    log.error("exportar uso de la empresa", { empresa_id: empresa.id, error: String(e) });
    return new Response("No se ha podido generar el CSV.", { status: 500 });
  }
}

import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { generarCsv } from "@/lib/contacts/csv";
import { filaExportacion } from "@/lib/contacts/exportar";
import { contactosParaExportar, leerFiltros } from "@/lib/contacts/queries";
import { getEmpresaActual } from "@/lib/empresa";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { respuestaCsv } from "@/lib/uso/consultas";

/**
 * Contactos de la empresa en CSV, con los mismos filtros que el listado
 * (?q=&estado=&seguimiento=1). Con la sesión del usuario: la BD comprueba
 * que es miembro. Cada exportación queda en la auditoría.
 */
export async function GET(request: NextRequest) {
  const [user, empresa] = await Promise.all([getCurrentUser(), getEmpresaActual()]);
  const { q, estados, seguimiento } = leerFiltros(Object.fromEntries(request.nextUrl.searchParams));
  const filtros = { q, estados, seguimiento };
  const supabase = await createClient();
  try {
    const { contactos, total, truncado } = await contactosParaExportar(supabase, empresa.id, filtros);
    await registrarAuditoria(supabase, {
      usuario: user.id,
      empresa_id: empresa.id,
      accion: "exportar_contactos",
      entidad: "contacto",
      detalle: { filtros, filas: contactos.length, total, truncado },
    });
    const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    return respuestaCsv(`contactos-${empresa.slug}-${hoy}.csv`, generarCsv(contactos.map(filaExportacion)));
  } catch (e) {
    log.error("exportar contactos", { empresa_id: empresa.id, error: String(e) });
    return new Response("No se ha podido generar el CSV.", { status: 500 });
  }
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActual } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { madridAUtc, partesMadrid } from "@/lib/time/madrid";
import { importe } from "@/lib/uso/calculo";
import { conexionCalendly } from "@/lib/calendly/conexion";
import { lineaDeEmpresa } from "@/lib/telefono";
import type { EstadoPrimerosPasos } from "./primeros-pasos";

/** Sin latido del despacho en este tiempo, la tarea programada no está corriendo. */
export const LATIDO_MAX_MS = 5 * 60_000;
const UNA_HORA_MS = 3_600_000;

export type Kpis = {
  llamadas: number;
  contestadas: number;
  citas: number;
  minutos: number;
  /** Minutos × tarifa de la empresa (EUR); null si el proveedor no le ha puesto tarifa. */
  importe: number | null;
};

/** 00:00 de Madrid de hace `dias` días. */
function inicioDia(ahora: Date, dias: number): Date {
  const p = partesMadrid(ahora);
  const d = new Date(Date.UTC(p.anio, p.mes - 1, p.dia - dias));
  return madridAUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 0, 0);
}

export async function leerKpis(ahora: Date): Promise<{ hoy: Kpis; semana: Kpis }> {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const { data: emp } = await supabase.from("empresas").select("precio_minuto").eq("id", empresa.id).maybeSingle();
  const precio = emp?.precio_minuto == null ? null : Number(emp.precio_minuto);
  const leer = async (desde: Date): Promise<Kpis> => {
    const { data, error } = await supabase.rpc("kpis_llamadas", {
      p_empresa_id: empresa.id,
      p_desde: desde.toISOString(),
    });
    if (error) throw new Error(`kpis: ${error.message}`);
    const k = data[0] ?? { llamadas: 0, contestadas: 0, citas: 0, segundos: 0 };
    const minutos = Number(k.segundos) / 60;
    return { llamadas: k.llamadas, contestadas: k.contestadas, citas: k.citas, minutos, importe: importe(minutos, precio) };
  };
  const [hoy, semana] = await Promise.all([leer(inicioDia(ahora, 0)), leer(inicioDia(ahora, 6))]);
  return { hoy, semana };
}

export async function llamadasEnCurso() {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("llamadas")
    .select("id, estado, creado_en, lote_id, contactos (nombre)")
    .eq("empresa_id", empresa.id)
    .in("estado", ["iniciada", "en_curso"])
    .order("creado_en", { ascending: false })
    .limit(20);
  if (error) throw new Error(`en curso: ${error.message}`);
  return data;
}

export async function seguimientos() {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("contactos")
    .select("id, nombre, seguimiento_motivo, actualizado_en", { count: "exact" })
    .eq("empresa_id", empresa.id)
    .eq("requiere_seguimiento", true)
    .neq("estado", "no_llamar")
    .order("actualizado_en", { ascending: false })
    .limit(5);
  if (error) throw new Error(`seguimientos: ${error.message}`);
  return { contactos: data, total: count ?? 0 };
}

export type Aviso = { nivel: "error" | "aviso"; texto: string; enlace?: { href: string; texto: string } };

/** Problemas recientes que alguien debería mirar (§12.2). */
export async function leerAvisos(ahora: Date): Promise<Aviso[]> {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  // eventos_webhook no es legible con la sesión (payloads crudos): solo se cuentan.
  const admin = createAdminClient();
  const haceUnaHora = new Date(ahora.getTime() - UNA_HORA_MS).toISOString();

  const [config, latido, lotes, fallosApi, webhooks, calendly] = await Promise.all([
    supabase.from("configuracion").select("pausa_global").eq("empresa_id", empresa.id).single(),
    supabase.from("latidos").select("en").eq("nombre", "despacho").maybeSingle(),
    supabase
      .from("lotes")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresa.id)
      .eq("estado", "activo"),
    supabase
      .from("llamadas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresa.id)
      .like("motivo_fallo", "api:%")
      .gte("creado_en", haceUnaHora),
    admin
      .from("eventos_webhook")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresa.id)
      .not("error", "is", null)
      .is("procesado_en", null)
      .gte("recibido_en", haceUnaHora),
    supabase
      .from("contactos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresa.id)
      .eq("seguimiento_motivo", "fallo_calendly")
      .gte("actualizado_en", haceUnaHora),
  ]);

  const avisos: Aviso[] = [];
  if (config.data?.pausa_global) {
    avisos.push({ nivel: "aviso", texto: "Pausa global activada: no se lanza ninguna llamada." });
  }
  const ultimoDespacho = latido.data ? new Date(latido.data.en).getTime() : null;
  if ((lotes.count ?? 0) > 0 && (ultimoDespacho == null || ahora.getTime() - ultimoDespacho > LATIDO_MAX_MS)) {
    avisos.push({
      nivel: "error",
      texto:
        ultimoDespacho == null
          ? "Hay lotes activos pero la tarea programada nunca se ha ejecutado: los lotes no avanzarán solos."
          : `Hay lotes activos pero la tarea programada no se ejecuta desde hace ${Math.round((ahora.getTime() - ultimoDespacho) / 60_000)} min.`,
      enlace: { href: "/app/lotes", texto: "Ver lotes" },
    });
  }
  if (fallosApi.count) {
    avisos.push({
      nivel: "error",
      texto: `${fallosApi.count} ${fallosApi.count === 1 ? "llamada no pudo iniciarse" : "llamadas no pudieron iniciarse"} en la última hora por un error del servicio de voz (ElevenLabs o la línea).`,
      enlace: { href: "/app/llamadas?estado=fallida", texto: "Ver fallidas" },
    });
  }
  if (webhooks.count) {
    avisos.push({
      nivel: "error",
      texto: `${webhooks.count} ${webhooks.count === 1 ? "aviso recibido" : "avisos recibidos"} de ElevenLabs o Calendly sin poder procesar en la última hora.`,
    });
  }
  if (calendly.count) {
    avisos.push({
      nivel: "error",
      texto: `Calendly no respondió durante ${calendly.count} ${calendly.count === 1 ? "llamada" : "llamadas"} en la última hora: esos contactos quedan para seguimiento.`,
      enlace: { href: "/app/contactos?seguimiento=1", texto: "Ver seguimientos" },
    });
  }
  return avisos;
}

/** Última pasada del motor de lotes, para la tarjeta de integraciones. */
export async function ultimoDespacho(): Promise<Date | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("latidos").select("en").eq("nombre", "despacho").maybeSingle();
  return data ? new Date(data.en) : null;
}

/** Datos para la tarjeta «Primeros pasos» del Resumen. */
export async function leerPrimerosPasos(): Promise<EstadoPrimerosPasos> {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const contar = (tabla: "contactos" | "lotes") =>
    supabase.from(tabla).select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id);

  const [emp, config, prueba, contactos, lotes, calendly, linea] = await Promise.all([
    supabase.from("empresas").select("guion_activo_id").eq("id", empresa.id).single(),
    supabase.from("configuracion").select("actualizado_por").eq("empresa_id", empresa.id).single(),
    supabase
      .from("llamadas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresa.id)
      .eq("es_prueba", true),
    contar("contactos"),
    contar("lotes"),
    conexionCalendly(empresa.id).catch(() => null),
    lineaDeEmpresa(empresa.id),
  ]);

  return {
    guionActivo: emp.data?.guion_activo_id != null,
    hayPrueba: (prueba.count ?? 0) > 0,
    calendly: calendly?.origen ?? null,
    configuracionRevisada: config.data?.actualizado_por != null,
    contactos: contactos.count ?? 0,
    linea: linea != null,
    lotes: lotes.count ?? 0,
  };
}

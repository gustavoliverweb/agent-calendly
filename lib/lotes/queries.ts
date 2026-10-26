import "server-only";
import { leerConfiguracion } from "@/lib/calls/config";
import { estaEnFranja, siguienteInicioFranja } from "@/lib/calls/window";
import { formatearHueco } from "@/lib/calendly/format-es";
import { createClient } from "@/lib/supabase/server";
import { contarItems } from "./estados";

export async function listarLotes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lotes")
    .select("id, nombre, estado, creado_en, lote_items (estado, proximo_intento_en), llamadas (cita_agendada)")
    .order("creado_en", { ascending: false })
    .limit(100);
  if (error) throw new Error(`No se pudieron cargar los lotes: ${error.message}`);
  return data.map(({ lote_items, llamadas, ...lote }) => ({
    ...lote,
    progreso: contarItems(lote_items),
    citas: llamadas.filter((l) => l.cita_agendada).length,
    proximoReintento:
      lote_items
        .filter((i) => i.estado === "esperando_reintento" && i.proximo_intento_en)
        .map((i) => i.proximo_intento_en!)
        .sort()[0] ?? null,
  }));
}

export type LoteFila = Awaited<ReturnType<typeof listarLotes>>[number];

export async function obtenerLote(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lotes")
    .select(
      "id, nombre, estado, creado_en, lote_items (id, estado, intentos, proximo_intento_en, motivo_omision, actualizado_en, contactos (id, nombre, telefono, estado), llamadas (id, estado, clasificacion, cita_agendada)), llamadas (cita_agendada)",
    )
    .eq("id", id)
    .order("creado_en", { referencedTable: "lote_items" })
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar el lote: ${error.message}`);
  return data;
}

/**
 * Si ahora no se despacha nada, por qué y cuándo se reanuda:
 * "Fuera de franja: se reanudará el lunes 2 de noviembre a las 10:00".
 */
export async function avisoDespacho(): Promise<string | null> {
  const supabase = await createClient();
  const config = await leerConfiguracion(supabase);
  const ahora = new Date();
  if (config.pausa_global) return "Pausa global activada: no se lanza ninguna llamada hasta reanudarla.";
  if (estaEnFranja(ahora, config)) return null;
  const siguiente = siguienteInicioFranja(ahora, config);
  const cuando = siguiente && formatearHueco(siguiente, ahora);
  return cuando
    ? `Fuera del horario de llamadas: se reanudará ${/^(hoy|mañana)/.test(cuando) ? cuando : `el ${cuando}`}.`
    : "No hay ninguna franja horaria configurada en los próximos 60 días.";
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isLlamadaEstado, type LlamadaEstado } from "./estados";

export const POR_PAGINA = 50;

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export type FiltrosLlamadas = { estados: LlamadaEstado[]; cita: boolean; pagina: number };

export function leerFiltrosLlamadas(sp: SearchParams): FiltrosLlamadas {
  const pagina = Number.parseInt(first(sp.pagina), 10);
  return {
    estados: first(sp.estado).split(",").filter(isLlamadaEstado),
    cita: first(sp.cita) === "1",
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

export async function listarLlamadas(f: FiltrosLlamadas) {
  const supabase = await createClient();
  let query = supabase
    .from("llamadas")
    .select(
      "id, estado, clasificacion, duracion_seg, cita_agendada, fecha_cita, motivo_fallo, creado_en, lote_id, contactos (id, nombre, telefono)",
      { count: "exact" },
    )
    .order("creado_en", { ascending: false })
    .order("id")
    .range((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA - 1);
  if (f.estados.length) query = query.in("estado", f.estados);
  if (f.cita) query = query.eq("cita_agendada", true);

  const { data, count, error } = await query;
  if (error) throw new Error(`No se pudieron cargar las llamadas: ${error.message}`);
  return { llamadas: data, total: count ?? 0 };
}

export type LlamadaFila = Awaited<ReturnType<typeof listarLlamadas>>["llamadas"][number];

export async function obtenerLlamada(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("llamadas")
    .select("*, contactos (id, nombre, telefono, email, estado)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar la llamada: ${error.message}`);
  return data;
}

/** Turno de la transcripción tal como lo guarda el webhook post-llamada. */
export type Turno = {
  role: string;
  message: string | null;
  time_in_call_secs: number | null;
  tools?: string[];
  tool_error?: boolean;
};

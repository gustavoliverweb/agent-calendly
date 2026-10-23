import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isContactoEstado, type ContactoEstado } from "./estados";

export const POR_PAGINA = 50;

export type FiltrosContactos = {
  q: string;
  estados: ContactoEstado[];
  seguimiento: boolean;
  pagina: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function leerFiltros(sp: SearchParams): FiltrosContactos {
  const pagina = Number.parseInt(first(sp.pagina), 10);
  return {
    q: first(sp.q).trim().slice(0, 100),
    estados: first(sp.estado).split(",").filter(isContactoEstado),
    seguimiento: first(sp.seguimiento) === "1",
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** Quita caracteres con significado en los filtros de PostgREST. */
function escaparBusqueda(q: string) {
  return q.replace(/[,()*%\\:"']/g, " ").trim();
}

export async function listarContactos(f: FiltrosContactos) {
  const supabase = await createClient();
  let query = supabase
    .from("contactos")
    .select(
      "id, nombre, telefono, email, estado, consentimiento, intentos, ultimo_intento_en, requiere_seguimiento, creado_en",
      { count: "exact" },
    )
    .order("creado_en", { ascending: false })
    .order("id")
    .range((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA - 1);

  if (f.estados.length) query = query.in("estado", f.estados);
  if (f.seguimiento) query = query.eq("requiere_seguimiento", true);

  const q = escaparBusqueda(f.q);
  if (q) {
    const condiciones = [`nombre.ilike.*${q}*`, `email.ilike.*${q}*`];
    const digitos = q.replace(/\D/g, "");
    if (digitos.length >= 3) condiciones.push(`telefono.ilike.*${digitos}*`);
    query = query.or(condiciones.join(","));
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`No se pudieron cargar los contactos: ${error.message}`);
  return { contactos: data, total: count ?? 0 };
}

export type ContactoFila = Awaited<ReturnType<typeof listarContactos>>["contactos"][number];

export async function contarPorEstado() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contactos_por_estado");
  if (error) throw new Error(`No se pudieron contar los contactos: ${error.message}`);
  const totales = Object.fromEntries(data.map((r) => [r.estado, Number(r.total)])) as Partial<
    Record<ContactoEstado, number>
  >;
  return totales;
}

export async function obtenerContacto(id: string) {
  const supabase = await createClient();
  const [contacto, llamadas, citas, auditoria] = await Promise.all([
    supabase.from("contactos").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("llamadas")
      .select("id, estado, clasificacion, duracion_seg, cita_agendada, fecha_cita, creado_en")
      .eq("contacto_id", id)
      .order("creado_en", { ascending: false })
      .limit(50),
    supabase
      .from("citas")
      .select("id, inicio, estado, creado_en")
      .eq("contacto_id", id)
      .order("inicio", { ascending: false }),
    supabase
      .from("auditoria")
      .select("id, accion, detalle, creado_en")
      .eq("entidad", "contacto")
      .eq("entidad_id", id)
      .order("creado_en", { ascending: false })
      .limit(20),
  ]);
  if (contacto.error) throw new Error(`No se pudo cargar el contacto: ${contacto.error.message}`);
  return {
    contacto: contacto.data,
    llamadas: llamadas.data ?? [],
    citas: citas.data ?? [],
    auditoria: auditoria.data ?? [],
  };
}

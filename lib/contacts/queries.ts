import "server-only";
import { getEmpresaActual } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { isContactoEstado, type ContactoEstado } from "./estados";
import { COLUMNAS_EXPORTACION, MAX_EXPORTACION, type ContactoExportable } from "./exportar";

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

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Consulta de contactos de la empresa con los filtros del listado aplicados. */
function consultaFiltrada(supabase: Supabase, empresaId: string, columnas: string, f: Omit<FiltrosContactos, "pagina">) {
  let query = supabase
    .from("contactos")
    .select(columnas, { count: "exact" })
    .eq("empresa_id", empresaId)
    .order("creado_en", { ascending: false })
    .order("id");

  if (f.estados.length) query = query.in("estado", f.estados);
  if (f.seguimiento) query = query.eq("requiere_seguimiento", true);

  const q = escaparBusqueda(f.q);
  if (q) {
    const condiciones = [`nombre.ilike.*${q}*`, `email.ilike.*${q}*`, `organizacion.ilike.*${q}*`];
    const digitos = q.replace(/\D/g, "");
    if (digitos.length >= 3) condiciones.push(`telefono.ilike.*${digitos}*`);
    query = query.or(condiciones.join(","));
  }
  return query;
}

const COLUMNAS_LISTADO =
  "id, nombre, telefono, email, estado, consentimiento, intentos, ultimo_intento_en, requiere_seguimiento, creado_en, organizacion, cargo";

export async function listarContactos(f: FiltrosContactos) {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const { data, count, error } = await consultaFiltrada(supabase, empresa.id, COLUMNAS_LISTADO, f)
    .range((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA - 1)
    .overrideTypes<ContactoListado[], { merge: false }>();
  if (error) throw new Error(`No se pudieron cargar los contactos: ${error.message}`);
  return { contactos: data, total: count ?? 0 };
}

type ContactoListado = Pick<
  Tables<"contactos">,
  | "id"
  | "nombre"
  | "telefono"
  | "email"
  | "estado"
  | "consentimiento"
  | "intentos"
  | "ultimo_intento_en"
  | "requiere_seguimiento"
  | "creado_en"
  | "organizacion"
  | "cargo"
>;

/**
 * Todos los contactos que cumplen los filtros, para exportar. Lee por páginas
 * de 1000 (el máximo de PostgREST) hasta MAX_EXPORTACION; `truncado` indica
 * que había más.
 */
export async function contactosParaExportar(
  supabase: Supabase,
  empresaId: string,
  f: Omit<FiltrosContactos, "pagina">,
): Promise<{ contactos: ContactoExportable[]; total: number; truncado: boolean }> {
  const PAGINA = 1000;
  const contactos: ContactoExportable[] = [];
  let total = 0;
  for (let desde = 0; desde < MAX_EXPORTACION; desde += PAGINA) {
    const { data, count, error } = await consultaFiltrada(supabase, empresaId, COLUMNAS_EXPORTACION, f)
      .range(desde, Math.min(desde + PAGINA, MAX_EXPORTACION) - 1)
      .overrideTypes<ContactoExportable[], { merge: false }>();
    if (error) throw new Error(`No se pudieron leer los contactos: ${error.message}`);
    total = count ?? total;
    contactos.push(...data);
    if (data.length < PAGINA) break;
  }
  return { contactos, total, truncado: total > contactos.length };
}

export type ContactoFila = Awaited<ReturnType<typeof listarContactos>>["contactos"][number];

export async function contarPorEstado() {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contactos_por_estado", { p_empresa_id: empresa.id });
  if (error) throw new Error(`No se pudieron contar los contactos: ${error.message}`);
  const totales = Object.fromEntries(data.map((r) => [r.estado, Number(r.total)])) as Partial<
    Record<ContactoEstado, number>
  >;
  return totales;
}

export async function obtenerContacto(id: string) {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const [contacto, llamadas, citas, auditoria] = await Promise.all([
    supabase.from("contactos").select("*").eq("id", id).eq("empresa_id", empresa.id).maybeSingle(),
    supabase
      .from("llamadas")
      .select("id, estado, clasificacion, duracion_seg, cita_agendada, fecha_cita, creado_en")
      .eq("contacto_id", id)
      .eq("empresa_id", empresa.id)
      .order("creado_en", { ascending: false })
      .limit(50),
    supabase
      .from("citas")
      .select("id, inicio, estado, creado_en")
      .eq("contacto_id", id)
      .eq("empresa_id", empresa.id)
      .order("inicio", { ascending: false }),
    supabase
      .from("auditoria")
      .select("id, accion, detalle, creado_en")
      .eq("entidad", "contacto")
      .eq("entidad_id", id)
      .eq("empresa_id", empresa.id)
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

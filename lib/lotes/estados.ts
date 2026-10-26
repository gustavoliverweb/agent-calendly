import type { Database } from "@/lib/supabase/database.types";

export type LoteEstado = Database["public"]["Enums"]["lote_estado"];
export type ItemEstado = Database["public"]["Enums"]["lote_item_estado"];

export const ETIQUETA_LOTE: Record<LoteEstado, string> = {
  activo: "Activo",
  pausado: "Pausado",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const COLOR_LOTE: Record<LoteEstado, string> = {
  activo: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  pausado: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  completado: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  cancelado: "bg-muted text-muted-foreground",
};

export const ESTADOS_ITEM: ItemEstado[] = ["en_cola", "en_llamada", "esperando_reintento", "completado", "omitido", "fallido"];

export const ETIQUETA_ITEM: Record<ItemEstado, string> = {
  en_cola: "En cola",
  en_llamada: "En llamada",
  esperando_reintento: "Esperando reintento",
  completado: "Completado",
  omitido: "Omitido",
  fallido: "Sin éxito",
};

export const COLOR_ITEM: Record<ItemEstado, string> = {
  en_cola: "bg-muted text-foreground",
  en_llamada: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  esperando_reintento: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  completado: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  omitido: "bg-muted text-muted-foreground",
  fallido: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

/** Por qué un item no se llamó o se abandonó (lote_items.motivo_omision). */
export const MOTIVO_ITEM: Record<string, string> = {
  no_llamar: "Pidió no ser llamado",
  cita_agendada: "Ya tiene cita",
  sin_consentimiento: "Sin consentimiento",
  en_otro_lote: "Ya está en otro lote activo",
  lote_cancelado: "Lote cancelado",
  no_contesta: "No contesta (sin más reintentos)",
  sin_franja: "No hay franja horaria disponible",
  error_api: "Error del servicio de voz",
};

export const motivoItem = (m: string | null) => (m ? (MOTIVO_ITEM[m] ?? m) : null);

/** Items que aún pueden generar una llamada. */
export const PENDIENTES: ItemEstado[] = ["en_cola", "en_llamada", "esperando_reintento"];

export type Progreso = Record<ItemEstado, number> & { total: number };

export function contarItems(items: { estado: ItemEstado }[]): Progreso {
  const p = Object.fromEntries(ESTADOS_ITEM.map((e) => [e, 0])) as Progreso;
  for (const i of items) p[i.estado]++;
  p.total = items.length;
  return p;
}

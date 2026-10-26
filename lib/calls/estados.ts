import type { Database } from "@/lib/supabase/database.types";
import type { Clasificacion } from "./outcome";

export type LlamadaEstado = Database["public"]["Enums"]["llamada_estado"];

export const ESTADOS_LLAMADA: LlamadaEstado[] = ["iniciada", "en_curso", "completada", "fallida", "buzon"];

export const ETIQUETA_LLAMADA: Record<LlamadaEstado, string> = {
  iniciada: "Iniciada",
  en_curso: "En curso",
  completada: "Completada",
  fallida: "Fallida",
  buzon: "Buzón de voz",
};

export const COLOR_LLAMADA: Record<LlamadaEstado, string> = {
  iniciada: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  en_curso: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  completada: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  fallida: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  buzon: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
};

export const ETIQUETA_CLASIFICACION: Record<Clasificacion, string> = {
  cita_agendada: "Cita agendada",
  no_interesado: "No interesado",
  rellamar: "Pide rellamada",
  no_llamar: "Pidió no llamar",
  sin_respuesta: "Sin respuesta",
  buzon: "Buzón de voz",
  otro: "Sin resultado concreto",
};

export const MOTIVO_FALLO: Record<string, string> = {
  busy: "Ocupado",
  "no-answer": "No contesta",
  unknown: "Error desconocido",
  timeout: "Sin respuesta del servicio de voz (cerrada por tiempo)",
};

export function isLlamadaEstado(v: string): v is LlamadaEstado {
  return (ESTADOS_LLAMADA as string[]).includes(v);
}

export function etiquetaClasificacion(c: string | null): string | null {
  return c ? (ETIQUETA_CLASIFICACION[c as Clasificacion] ?? c) : null;
}

/** 95 → "1:35" */
export function formatearDuracion(seg: number | null): string {
  if (seg == null) return "—";
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

import type { Database } from "@/lib/supabase/database.types";

export type ContactoEstado = Database["public"]["Enums"]["contacto_estado"];

export const ESTADOS: ContactoEstado[] = [
  "pendiente",
  "llamado",
  "cita_agendada",
  "no_interesado",
  "no_contesta",
  "no_llamar",
];

export const ETIQUETA_ESTADO: Record<ContactoEstado, string> = {
  pendiente: "Pendiente",
  llamado: "Llamado",
  cita_agendada: "Cita agendada",
  no_interesado: "No interesado",
  no_contesta: "No contesta",
  no_llamar: "No llamar",
};

/** Clases de color para cada estado (badge). */
export const COLOR_ESTADO: Record<ContactoEstado, string> = {
  pendiente: "bg-muted text-muted-foreground",
  llamado: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  cita_agendada: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  no_interesado: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  no_contesta: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  no_llamar: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function isContactoEstado(value: string): value is ContactoEstado {
  return (ESTADOS as string[]).includes(value);
}

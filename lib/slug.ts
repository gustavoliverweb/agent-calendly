import { z } from "zod";

/** Subdominios que no puede usar una empresa (marca blanca, fase S6b). */
const RESERVADOS = new Set(["admin", "api", "app", "www", "mail", "soporte", "ayuda", "status", "login"]);

/** "Clínica Sonrisa, S.L." → "clinica-sonrisa-sl" */
export function slugDesdeNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

/** Mismo formato que la restricción de empresas.slug en la BD. */
export const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/, "Solo minúsculas, números y guiones (máx. 50), sin guion al principio ni al final")
  .refine((s) => !RESERVADOS.has(s), "Ese identificador está reservado");

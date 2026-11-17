import { z } from "zod";

/** Opciones del formulario de contacto (las mismas en la web y en /admin). */
export const SECTORES = [
  "Clínica o centro de salud",
  "Inmobiliaria",
  "Academia o formación",
  "Servicios a empresas (B2B)",
  "Agencia",
  "Otro",
] as const;

export const VOLUMENES = ["Menos de 100", "100–500", "500–2.000", "Más de 2.000", "Aún no lo sé"] as const;

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const solicitudSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe tu nombre").max(120, "Nombre demasiado largo"),
  email: z.string().trim().toLowerCase().pipe(z.email("Escribe un email válido")).pipe(z.string().max(200)),
  empresa: opcional(200),
  telefono: opcional(40),
  sector: z
    .string()
    .optional()
    .transform((v) => (v && (SECTORES as readonly string[]).includes(v) ? v : null)),
  volumen: z
    .string()
    .optional()
    .transform((v) => (v && (VOLUMENES as readonly string[]).includes(v) ? v : null)),
  mensaje: opcional(3000),
  origen: z
    .string()
    .optional()
    .transform((v) => (v && /^\/[a-z0-9/-]{0,120}$/.test(v) ? v : null)),
  privacidad: z.literal("on", { error: "Necesitamos que aceptes la política de privacidad para responderte" }),
});

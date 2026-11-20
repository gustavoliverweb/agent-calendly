import { z } from "zod";

/** Formulario de la sección Marca (sin las imágenes, que se suben aparte). */

const opcional = (max: number, etiqueta: string) =>
  z
    .string()
    .trim()
    .max(max, `${etiqueta}: máximo ${max} caracteres`)
    .transform((v) => v || null);

export const marcaFormSchema = z.object({
  nombre: opcional(60, "Nombre visible"),
  color: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || /^#[0-9a-f]{6}$/.test(v), "Color: formato #rrggbb")
    .transform((v) => v || null),
  razonSocial: opcional(200, "Razón social"),
  nif: opcional(20, "NIF").transform((v) => v?.toUpperCase().replace(/[\s-]/g, "") ?? null),
  domicilio: opcional(300, "Domicilio"),
  registro: opcional(300, "Datos registrales"),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Email de contacto no válido")
    .transform((v) => v || null),
});

export type MarcaForm = z.input<typeof marcaFormSchema>;

export const TIPOS_IMAGEN = ["logo", "favicon"] as const;
export type TipoImagen = (typeof TIPOS_IMAGEN)[number];

export const MAX_BYTES_IMAGEN = 512 * 1024;

/**
 * Formato real de la imagen por sus primeros bytes (no por la extensión ni el
 * tipo que diga el navegador). Sin SVG: podría llevar scripts.
 */
export function formatoImagen(bytes: Uint8Array): { tipo: string; extension: string } | null {
  const b = (i: number) => bytes[i];
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return { tipo: "image/png", extension: "png" };
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { tipo: "image/jpeg", extension: "jpg" };
  const ascii = (desde: number, hasta: number) => String.fromCharCode(...bytes.slice(desde, hasta));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { tipo: "image/webp", extension: "webp" };
  return null;
}

/** /admin → Marca: la marca de la plataforma. Vacío = el valor por defecto. */
export const marcaPlataformaSchema = z.object({
  nombre: opcional(60, "Nombre"),
  descripcion: opcional(300, "Descripción"),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Email de contacto no válido")
    .transform((v) => v || null),
});

export type MarcaPlataformaForm = z.input<typeof marcaPlataformaSchema>;

import { z } from "zod";
import { normalizePhone } from "./phone";
import { clean, parseFecha } from "./parse";

/** Formulario de alta/edición de un contacto (FormData → datos de BD). */
export const contactoFormSchema = z
  .object({
    nombre: z.string().transform(clean).pipe(z.string("El nombre es obligatorio").min(1)),
    telefono: z.string().transform((v, ctx) => {
      const r = normalizePhone(v);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: "Teléfono no válido" });
        return z.NEVER;
      }
      return r.e164;
    }),
    email: z
      .string()
      .optional()
      .transform((v) => clean(v)?.toLowerCase() ?? null)
      .pipe(z.email("Email no válido").nullable()),
    consentimiento: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    consentimiento_fecha: z
      .string()
      .optional()
      .transform((v, ctx) => {
        const value = clean(v);
        if (!value) return null;
        const iso = parseFecha(value);
        if (!iso) {
          ctx.addIssue({ code: "custom", message: "Fecha de consentimiento no válida" });
          return z.NEVER;
        }
        return iso;
      }),
    consentimiento_origen: z.string().optional().transform((v) => clean(v)),
    notas: z.string().optional().transform((v) => (v ?? "").trim() || null),
  })
  .transform((d) => ({
    ...d,
    // Con consentimiento y sin fecha, se registra el momento del alta.
    consentimiento_fecha: d.consentimiento ? (d.consentimiento_fecha ?? new Date().toISOString()) : null,
    consentimiento_origen: d.consentimiento ? d.consentimiento_origen : null,
  }));

export type ContactoForm = z.output<typeof contactoFormSchema>;

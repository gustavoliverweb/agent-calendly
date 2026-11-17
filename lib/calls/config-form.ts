import { z } from "zod";
import { franjasSchema } from "./window";

/**
 * comercial: solo contactos con consentimiento. no_comercial: relación previa.
 * b2b: llamadas a empresas (interés legítimo); exige la empresa del contacto y
 * el origen de sus datos, y que el proveedor lo haya habilitado.
 */
export const TIPOS_CAMPANA = ["comercial", "no_comercial", "b2b"] as const;
export type TipoCampana = (typeof TIPOS_CAMPANA)[number];

export function esTipoCampana(v: string): v is TipoCampana {
  return (TIPOS_CAMPANA as readonly string[]).includes(v);
}

/** Lo que se edita en Configuración. La pausa global va aparte (botón propio). */
export const configuracionFormSchema = z.object({
  max_concurrencia: z.coerce.number({ error: "Introduce un número" }).int().min(1, "Mínimo 1").max(10, "Máximo 10"),
  franjas: franjasSchema.min(1, "Añade al menos una franja horaria"),
  festivos: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha AAAA-MM-DD"))
    .max(200)
    .transform((f) => [...new Set(f)].sort()),
  max_reintentos: z.coerce.number({ error: "Introduce un número" }).int().min(0, "Mínimo 0").max(10, "Máximo 10"),
  horas_entre_reintentos: z.coerce.number({ error: "Introduce un número" }).int().min(1, "Mínimo 1 hora").max(720, "Máximo 720 horas"),
  tipo_campana: z.enum(TIPOS_CAMPANA),
  timeout_llamada_min: z.coerce.number({ error: "Introduce un número" }).int().min(5, "Mínimo 5 minutos").max(120, "Máximo 120 minutos"),
  retencion_transcripciones_dias: z.coerce
    .number({ error: "Introduce un número" })
    .int()
    .min(30, "Conserva las transcripciones al menos 30 días")
    .max(3650, "Máximo 3.650 días"),
  retencion_webhooks_dias: z.coerce
    .number({ error: "Introduce un número" })
    .int()
    .min(7, "Conserva los avisos recibidos al menos 7 días")
    .max(365, "Máximo 365 días"),
});

export type ConfiguracionForm = z.input<typeof configuracionFormSchema>;

/** Mismo criterio que public.motivo_campana en la BD: por qué no se puede llamar a un contacto, o null. */
export function motivoCampana(
  tipo: TipoCampana,
  c: { consentimiento: boolean; organizacion?: string | null; origen_datos?: string | null },
): "sin_consentimiento" | "sin_datos_b2b" | null {
  if (tipo === "comercial" && !c.consentimiento) return "sin_consentimiento";
  if (tipo === "b2b" && (!c.organizacion?.trim() || !c.origen_datos?.trim())) return "sin_datos_b2b";
  return null;
}

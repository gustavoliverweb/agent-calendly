import { z } from "zod";
import { franjasSchema } from "./window";

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
  tipo_campana: z.enum(["comercial", "no_comercial"]),
  timeout_llamada_min: z.coerce.number({ error: "Introduce un número" }).int().min(5, "Mínimo 5 minutos").max(120, "Máximo 120 minutos"),
});

export type ConfiguracionForm = z.input<typeof configuracionFormSchema>;

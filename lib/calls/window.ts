import { z } from "zod";
import { fechaMadrid, madridAUtc, partesMadrid } from "@/lib/time/madrid";

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora HH:MM");

export const franjaSchema = z
  .object({
    dias: z.array(z.number().int().min(1).max(7)).min(1),
    desde: hora,
    hasta: hora,
  })
  .refine((f) => f.desde < f.hasta, "La franja debe terminar después de empezar");

export const franjasSchema = z.array(franjaSchema);
export const festivosSchema = z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export type Franja = z.infer<typeof franjaSchema>;
export type Calendario = { franjas: Franja[]; festivos: string[] };

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** ¿Se puede llamar en este instante? Franjas en hora de Madrid, [desde, hasta). */
export function estaEnFranja(fecha: Date, cal: Calendario): boolean {
  if (cal.festivos.includes(fechaMadrid(fecha))) return false;
  const p = partesMadrid(fecha);
  const ahora = p.hora * 60 + p.minuto;
  return cal.franjas.some(
    (f) => f.dias.includes(p.diaSemana) && ahora >= minutos(f.desde) && ahora < minutos(f.hasta),
  );
}

/**
 * Primer instante >= `fecha` en el que se puede llamar: la propia fecha si
 * ya está en franja o el próximo inicio de franja. null si no hay ninguno en
 * los próximos 60 días (franjas vacías o todo festivo).
 */
export function siguienteInicioFranja(fecha: Date, cal: Calendario): Date | null {
  if (estaEnFranja(fecha, cal)) return fecha;
  const hoy = partesMadrid(fecha);
  for (let d = 0; d < 60; d++) {
    const dia = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia + d));
    const [anio, mes, diaMes] = [dia.getUTCFullYear(), dia.getUTCMonth() + 1, dia.getUTCDate()];
    const inicios = cal.franjas
      .map((f) => {
        const [h, m] = [Number(f.desde.slice(0, 2)), Number(f.desde.slice(3, 5))];
        return madridAUtc(anio, mes, diaMes, h, m);
      })
      .filter((t) => t > fecha && estaEnFranja(t, cal))
      .sort((a, b) => a.getTime() - b.getTime());
    if (inicios.length) return inicios[0];
  }
  return null;
}

const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];

/** "L–V 10:00–14:00 · L–V 16:00–20:00", para mensajes y el panel. */
export function describirFranjas(franjas: Franja[]): string {
  return franjas
    .map((f) => {
      const dias = [...f.dias].sort();
      const seguidos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
      const txt =
        seguidos && dias.length > 2
          ? `${DIAS_CORTOS[dias[0] - 1]}–${DIAS_CORTOS[dias.at(-1)! - 1]}`
          : dias.map((d) => DIAS_CORTOS[d - 1]).join(",");
      return `${txt} ${f.desde}–${f.hasta}`;
    })
    .join(" · ");
}

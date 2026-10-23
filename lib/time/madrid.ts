/**
 * Fechas en Europe/Madrid sin dependencias. La app guarda y envía todo en UTC;
 * Madrid solo se usa para interpretar lo que dice el contacto ("el jueves"),
 * para hablarle y para las franjas de llamada.
 */

export const TZ = "Europe/Madrid";

export type PartesMadrid = {
  anio: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  /** 1 = lunes … 7 = domingo (ISO) */
  diaSemana: number;
};

const partesFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  hourCycle: "h23",
});

const DIAS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function partesMadrid(fecha: Date): PartesMadrid {
  const p = Object.fromEntries(partesFmt.formatToParts(fecha).map((x) => [x.type, x.value]));
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    diaSemana: DIAS_EN.indexOf(p.weekday) + 1,
  };
}

/** Diferencia (ms) entre la hora de Madrid y UTC en ese instante. */
function offsetMs(fecha: Date): number {
  const p = partesMadrid(fecha);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
  return comoUtc - Math.floor(fecha.getTime() / 60_000) * 60_000;
}

/**
 * Instante UTC de una hora de pared en Madrid. En el cambio de horario,
 * una hora inexistente (02:30 de marzo) se desplaza hacia delante y una
 * repetida (02:30 de octubre) toma la primera aparición.
 */
export function madridAUtc(anio: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
  const pared = Date.UTC(anio, mes - 1, dia, hora, minuto);
  // Los dos desfases posibles ese día: el de antes y el de después del cambio.
  const antes = offsetMs(new Date(pared - 86_400_000));
  const despues = offsetMs(new Date(pared + 86_400_000));
  const validos = [pared - antes, pared - despues].filter((t) => {
    const p = partesMadrid(new Date(t));
    return p.dia === dia && p.hora === hora && p.minuto === minuto;
  });
  // Ninguno válido: hora saltada; con el desfase previo cae justo después del salto.
  return new Date(validos.length ? Math.min(...validos) : pared - antes);
}

/** 'YYYY-MM-DD' del día en Madrid. */
export function fechaMadrid(fecha: Date): string {
  const p = partesMadrid(fecha);
  return `${p.anio}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

/** Interpreta 'YYYY-MM-DD' como día de Madrid; devuelve null si no es válido. */
export function leerFechaMadrid(texto: string): { anio: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return { anio, mes, dia };
}

/** Días naturales de Madrid entre dos instantes (b − a). */
export function diasEntre(a: Date, b: Date): number {
  const pa = partesMadrid(a);
  const pb = partesMadrid(b);
  return Math.round(
    (Date.UTC(pb.anio, pb.mes - 1, pb.dia) - Date.UTC(pa.anio, pa.mes - 1, pa.dia)) / 86_400_000,
  );
}

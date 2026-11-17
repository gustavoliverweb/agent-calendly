/**
 * Uso por empresa y mes (plan SaaS §4.1 y §4.2): meses, minutos, importes y
 * filas de los CSV para facturar. Sin dependencias de servidor, para probarlo.
 *
 * Los minutos que cuentan (para el límite y la factura) son los de todas las
 * conversaciones, también las pruebas en el navegador: ElevenLabs las cobra igual.
 */
import { ETIQUETA_LLAMADA, etiquetaClasificacion, type LlamadaEstado } from "@/lib/calls/estados";
import { partesMadrid, TZ } from "@/lib/time/madrid";

/** Mes como "AAAA-MM-01" (lo que reciben las funciones de la BD). */
export type Mes = string;

export type UsoPeriodo = {
  llamadas: number;
  contestadas: number;
  citas: number;
  citas_canceladas: number;
  segundos: number;
  pruebas: number;
  segundos_pruebas: number;
};

const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const pad = (n: number) => String(n).padStart(2, "0");

export function mesActual(ahora: Date): Mes {
  const p = partesMadrid(ahora);
  return `${p.anio}-${pad(p.mes)}-01`;
}

/** "AAAA-MM" de la URL → Mes; el actual si falta, es inválido o es futuro. */
export function leerMes(valor: unknown, ahora: Date): Mes {
  const actual = mesActual(ahora);
  if (typeof valor !== "string") return actual;
  const m = MES_RE.exec(valor);
  if (!m) return actual;
  const mes = `${m[1]}-${m[2]}-01`;
  return mes > actual || Number(m[1]) < 2020 ? actual : mes;
}

export function sumarMeses(mes: Mes, n: number): Mes {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
}

/** Para la URL: "AAAA-MM". */
export const claveMes = (mes: Mes) => mes.slice(0, 7);

const nombreMes = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
/** "noviembre de 2026" */
export function etiquetaMes(mes: Mes): string {
  return nombreMes.format(new Date(`${mes}T00:00:00Z`));
}

/** Minutos con un decimal, como minutos_mes en la BD. */
export function minutos(segundos: number): number {
  return Math.round((Number(segundos) / 60) * 10) / 10;
}

export function minutosTotales(u: Pick<UsoPeriodo, "segundos" | "segundos_pruebas">): number {
  return minutos(Number(u.segundos) + Number(u.segundos_pruebas));
}

/** Importe en euros (null sin tarifa), redondeado a céntimos. */
export function importe(min: number, precioMinuto: number | null): number | null {
  if (precioMinuto == null) return null;
  return Math.round(min * Number(precioMinuto) * 100) / 100;
}

/** Número para Excel en español: coma decimal. */
function num(n: number | null, decimales = 2): string {
  if (n == null) return "";
  return n.toFixed(decimales).replace(".", ",");
}

export type FilaPlataforma = UsoPeriodo & {
  nombre: string;
  slug: string;
  estado: string;
  precio_minuto: number | null;
  limite_minutos_mes: number | null;
};

/** CSV de /admin: una fila por empresa y mes. */
export function filaResumenCsv(mes: Mes, f: FilaPlataforma, costeMinutoUsd: number): Record<string, string | number> {
  const total = minutosTotales(f);
  return {
    Mes: claveMes(mes),
    Empresa: f.nombre,
    Identificador: f.slug,
    Estado: f.estado,
    Llamadas: f.llamadas,
    Contestadas: f.contestadas,
    Citas: f.citas,
    "Citas canceladas": f.citas_canceladas,
    "Minutos llamadas": num(minutos(f.segundos), 1),
    "Pruebas en navegador": f.pruebas,
    "Minutos pruebas": num(minutos(f.segundos_pruebas), 1),
    "Minutos totales": num(total, 1),
    "Límite minutos/mes": f.limite_minutos_mes ?? "",
    "Tarifa (EUR/min)": num(f.precio_minuto == null ? null : Number(f.precio_minuto), 4),
    "Importe estimado (EUR)": num(importe(total, f.precio_minuto)),
    "Coste estimado ElevenLabs (USD)": num(total * costeMinutoUsd),
  };
}

export type LlamadaMes = {
  id: string;
  creado_en: string;
  estado: LlamadaEstado;
  clasificacion: string | null;
  duracion_seg: number | null;
  cita_agendada: boolean;
  es_prueba: boolean;
  lote_id: string | null;
};

const fechaHora = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** CSV de detalle: una fila por llamada, sin datos personales del contacto. */
export function filaDetalleCsv(l: LlamadaMes): Record<string, string | number> {
  return {
    "Fecha (Madrid)": fechaHora.format(new Date(l.creado_en)),
    Llamada: l.id,
    Tipo: l.es_prueba ? "Prueba en navegador" : l.lote_id ? "Lote" : "Manual",
    Estado: ETIQUETA_LLAMADA[l.estado] ?? l.estado,
    Resultado: etiquetaClasificacion(l.clasificacion) ?? "",
    "Duración (s)": l.duracion_seg ?? 0,
    Minutos: num(minutos(l.duracion_seg ?? 0), 1),
    Cita: l.cita_agendada ? "Sí" : "No",
  };
}

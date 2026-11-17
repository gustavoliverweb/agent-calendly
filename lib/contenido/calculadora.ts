/**
 * Cálculo de la calculadora de retorno de la web (/calculadora). Todo lo pone
 * quien la usa: los valores iniciales son solo un ejemplo para que no
 * aparezca vacía, no datos de clientes reales.
 */

export type Supuestos = {
  /** Leads al mes. */
  leads: number;
  /** % de leads que acaban contestando (contando reintentos). */
  contestan: number;
  /** % de quienes contestan que reservan cita. */
  agendan: number;
  /** % de citas que acaban en cliente. */
  cierran: number;
  /** Ingreso medio por cliente nuevo, en euros. */
  valorCliente: number;
  /** Duración media de una llamada contestada, en minutos. */
  minutosLlamada: number;
  /** Precio por minuto de conversación en euros; null si aún no se conoce. */
  precioMinuto: number | null;
};

export const SUPUESTOS_EJEMPLO: Supuestos = {
  leads: 300,
  contestan: 60,
  agendan: 25,
  cierran: 40,
  valorCliente: 300,
  minutosLlamada: 3,
  precioMinuto: null,
};

export type Resultado = {
  contestadas: number;
  citas: number;
  clientes: number;
  ingresos: number;
  minutos: number;
  horas: number;
  /** null sin precio por minuto. */
  coste: number | null;
  /** Ingresos / coste; null sin coste o con coste 0. */
  retorno: number | null;
  /** Coste por cita; null sin coste o sin citas. */
  costePorCita: number | null;
};

const pct = (v: number) => Math.min(Math.max(v, 0), 100) / 100;
const pos = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

export function calcular(s: Supuestos): Resultado {
  const contestadas = pos(s.leads) * pct(s.contestan);
  const citas = contestadas * pct(s.agendan);
  const clientes = citas * pct(s.cierran);
  const ingresos = clientes * pos(s.valorCliente);
  // Las llamadas sin respuesta apenas consumen minutos de conversación.
  const minutos = contestadas * pos(s.minutosLlamada);
  const coste = s.precioMinuto == null || !Number.isFinite(s.precioMinuto) ? null : minutos * pos(s.precioMinuto);
  return {
    contestadas: Math.round(contestadas),
    citas: Math.round(citas),
    clientes: Math.round(clientes),
    ingresos: Math.round(ingresos),
    minutos: Math.round(minutos),
    horas: Math.round((minutos / 60) * 10) / 10,
    coste: coste == null ? null : Math.round(coste * 100) / 100,
    retorno: coste ? Math.round((ingresos / coste) * 10) / 10 : null,
    costePorCita: coste != null && citas > 0 ? Math.round((coste / citas) * 100) / 100 : null,
  };
}

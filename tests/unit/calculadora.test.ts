import { describe, expect, it } from "vitest";
import { calcular, SUPUESTOS_EJEMPLO } from "@/lib/contenido/calculadora";

describe("calculadora de retorno", () => {
  it("encadena contestan → agendan → cierran", () => {
    const r = calcular(SUPUESTOS_EJEMPLO);
    expect(r).toMatchObject({ contestadas: 180, citas: 45, clientes: 18, ingresos: 5400, minutos: 540, horas: 9 });
  });

  it("sin precio por minuto no inventa coste ni retorno", () => {
    const r = calcular(SUPUESTOS_EJEMPLO);
    expect(r.coste).toBeNull();
    expect(r.retorno).toBeNull();
    expect(r.costePorCita).toBeNull();
  });

  it("con precio calcula coste, retorno y coste por cita", () => {
    const r = calcular({ ...SUPUESTOS_EJEMPLO, precioMinuto: 0.5 });
    expect(r.coste).toBe(270);
    expect(r.retorno).toBe(20);
    expect(r.costePorCita).toBe(6);
  });

  it("acota porcentajes y descarta negativos o NaN", () => {
    const r = calcular({ ...SUPUESTOS_EJEMPLO, leads: -5, contestan: 150, precioMinuto: Number.NaN });
    expect(r.contestadas).toBe(0);
    expect(r.coste).toBeNull();
    expect(calcular({ ...SUPUESTOS_EJEMPLO, contestan: 150 }).contestadas).toBe(300);
  });

  it("precio 0 da coste 0 sin dividir por cero", () => {
    const r = calcular({ ...SUPUESTOS_EJEMPLO, precioMinuto: 0 });
    expect(r.coste).toBe(0);
    expect(r.retorno).toBeNull();
  });
});

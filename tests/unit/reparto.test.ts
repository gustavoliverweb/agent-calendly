import { describe, expect, it } from "vitest";
import { calcularCuota } from "@/lib/calls/reparto";

describe("calcularCuota", () => {
  it("reparte los huecos libres a partes iguales", () => {
    expect(calcularCuota(10, 2, 4)).toBe(2);
    expect(calcularCuota(10, 0, 3)).toBe(3);
  });

  it("una sola empresa con cola puede usar todos los huecos libres", () => {
    expect(calcularCuota(10, 4, 1)).toBe(6);
  });

  it("con menos huecos que empresas, una por turno (mínimo 1)", () => {
    expect(calcularCuota(5, 3, 4)).toBe(1);
    expect(calcularCuota(5, 5, 2)).toBe(1);
  });

  it("sin empresas con cola no divide por cero", () => {
    expect(calcularCuota(5, 0, 0)).toBe(5);
  });
});

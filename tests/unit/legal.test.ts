import { describe, expect, it } from "vitest";
import { huecosPendientes, legalEsBorrador, type CampoTitular } from "@/lib/legal";

const completo: Record<CampoTitular, string | null> = {
  razonSocial: "Ejemplo, S.L.",
  nif: "B00000000",
  domicilio: "Calle Mayor 1, 28001 Madrid",
  registro: "Registro Mercantil de Madrid, tomo 1, folio 1, hoja M-1",
  email: "legal@ejemplo.es",
  telefono: null,
  dpd: null,
  operadorTelefonico: "Operador, S.A.",
};

describe("huecosPendientes", () => {
  it("ignora los campos opcionales", () => {
    expect(huecosPendientes(completo)).toEqual([]);
  });
  it("trata los textos vacíos como pendientes", () => {
    expect(huecosPendientes({ ...completo, nif: "  ", domicilio: null })).toEqual(["nif", "domicilio"]);
  });
});

describe("legalEsBorrador", () => {
  it("es borrador mientras falten datos", () => {
    expect(legalEsBorrador({ ...completo, razonSocial: null }, true)).toBe(true);
  });
  it("es borrador mientras no se revisen los textos", () => {
    expect(legalEsBorrador(completo, false)).toBe(true);
  });
  it("deja de serlo con datos completos y textos revisados", () => {
    expect(legalEsBorrador(completo, true)).toBe(false);
  });
});

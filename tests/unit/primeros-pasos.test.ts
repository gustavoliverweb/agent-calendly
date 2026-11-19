import { describe, expect, it } from "vitest";
import { construirPasos, type EstadoPrimerosPasos } from "@/lib/dashboard/primeros-pasos";

const nueva: EstadoPrimerosPasos = {
  guionActivo: false,
  hayPrueba: false,
  calendly: null,
  configuracionRevisada: false,
  contactos: 0,
  linea: false,
  lotes: 0,
};

const hechos = (e: EstadoPrimerosPasos) => construirPasos(e).filter((p) => p.hecho).map((p) => p.id);

describe("primeros pasos", () => {
  it("una empresa nueva no tiene nada hecho", () => {
    expect(hechos(nueva)).toEqual([]);
  });

  it("se marcan solos según los datos", () => {
    expect(hechos({ ...nueva, guionActivo: true, contactos: 3, linea: true })).toEqual(["guion", "contactos", "linea"]);
  });

  it("todo hecho", () => {
    const todo = { guionActivo: true, hayPrueba: true, calendly: "oauth", configuracionRevisada: true, contactos: 1, linea: true, lotes: 1 } as const;
    expect(construirPasos(todo).every((p) => p.hecho)).toBe(true);
  });

  it("la agenda provisional cuenta como hecha pero lo dice", () => {
    const calendly = construirPasos({ ...nueva, calendly: "entorno" }).find((p) => p.id === "calendly")!;
    expect(calendly.hecho).toBe(true);
    expect(calendly.descripcion).toMatch(/provisional/);
  });

  it("la línea no tiene enlace: la da de alta la plataforma", () => {
    expect(construirPasos(nueva).find((p) => p.id === "linea")!.href).toBeUndefined();
  });
});

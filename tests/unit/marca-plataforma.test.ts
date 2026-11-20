import { describe, expect, it } from "vitest";
import { marcaPlataformaSchema } from "@/lib/dominio/marca-form";

describe("marca de la plataforma", () => {
  it("vacío significa «usar el valor por defecto»", () => {
    expect(marcaPlataformaSchema.parse({ nombre: "  ", descripcion: "", email: "" })).toEqual({
      nombre: null,
      descripcion: null,
      email: null,
    });
  });

  it("recorta y acepta valores válidos", () => {
    expect(marcaPlataformaSchema.parse({ nombre: " Vozia ", descripcion: "Agente que agenda.", email: "hola@vozia.es" })).toEqual({
      nombre: "Vozia",
      descripcion: "Agente que agenda.",
      email: "hola@vozia.es",
    });
  });

  it.each([
    [{ nombre: "x".repeat(61), descripcion: "", email: "" }, /Nombre/],
    [{ nombre: "", descripcion: "x".repeat(301), email: "" }, /Descripción/],
    [{ nombre: "", descripcion: "", email: "no-es-email" }, /Email/],
  ])("rechaza %j", (datos, error) => {
    const r = marcaPlataformaSchema.safeParse(datos);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(error);
  });
});

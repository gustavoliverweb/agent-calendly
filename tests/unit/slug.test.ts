import { describe, expect, it } from "vitest";
import { slugDesdeNombre, slugSchema } from "@/lib/slug";

describe("slugDesdeNombre", () => {
  it("quita tildes, signos y espacios", () => {
    expect(slugDesdeNombre("Clínica Sonrisa, S.L.")).toBe("clinica-sonrisa-s-l");
    expect(slugDesdeNombre("  Ñandú & Co  ")).toBe("nandu-co");
  });

  it("no deja guiones al final al recortar", () => {
    const slug = slugDesdeNombre(`${"a".repeat(49)} b`);
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("slugSchema", () => {
  it("acepta el formato de la BD", () => {
    expect(slugSchema.safeParse("clinica-sonrisa").success).toBe(true);
    expect(slugSchema.safeParse("a").success).toBe(true);
  });

  it("rechaza formatos inválidos y reservados", () => {
    for (const s of ["-a", "a-", "Mayus", "con espacio", "a".repeat(51), "admin", "www"]) {
      expect(slugSchema.safeParse(s).success, s).toBe(false);
    }
  });
});

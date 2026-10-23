import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone, maskText, sanitize } from "@/lib/log";

describe("maskPhone", () => {
  it("enmascara un móvil español en E.164", () => {
    expect(maskPhone("+34600112233")).toBe("+34******233");
  });
  it("enmascara números con espacios", () => {
    expect(maskPhone("600 11 22 33")).toBe("60****233");
  });
  it("no revela números muy cortos", () => {
    expect(maskPhone("12345")).toBe("***");
  });
});

describe("maskEmail", () => {
  it("deja solo la inicial y el dominio", () => {
    expect(maskEmail("maria@example.com")).toBe("m***@example.com");
  });
  it("maneja textos que no son email", () => {
    expect(maskEmail("sin-arroba")).toBe("***");
  });
});

describe("maskText", () => {
  it("enmascara teléfonos y emails dentro de un mensaje", () => {
    expect(maskText("Llamando a +34600112233 (maria@example.com)")).toBe(
      "Llamando a +34******233 (m***@example.com)",
    );
  });
  it("no confunde UUID con teléfonos", () => {
    for (const id of ["00000000-0000-4000-8000-000000000000", "12345678-1234-4abc-8def-123456789012"]) {
      expect(maskText(`llamada ${id}`)).toBe(`llamada ${id}`);
    }
    expect(maskText("tel:600 11 22 33.")).toBe("tel:60****233.");
  });
});

describe("sanitize", () => {
  it("omite claves sensibles y enmascara anidados", () => {
    expect(
      sanitize({
        telefono: "+34600112233",
        transcripcion: [{ message: "hola" }],
        contacto: { email: "maria@example.com" },
        intentos: 2,
      }),
    ).toEqual({
      telefono: "+34******233",
      transcripcion: "[omitido]",
      contacto: { email: "m***@example.com" },
      intentos: 2,
    });
  });
});

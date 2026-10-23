import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/contacts/phone";
import { parseConsent, parseFecha } from "@/lib/contacts/parse";
import { aplicarMapeo, decodificar, detectarMapeo, parsearCsv } from "@/lib/contacts/csv";
import { resumir, validarFilas } from "@/lib/contacts/import";

describe("normalizePhone", () => {
  it.each([
    ["600 11 22 33", "+34600112233"],
    ["+34 600-112-233", "+34600112233"],
    ["0034600112233", "+34600112233"],
    ["(+34) 600.11.22.33", "+34600112233"],
    ["712345678", "+34712345678"],
    ["912 345 678", "+34912345678"],
  ])("%s → %s", (raw, e164) => {
    expect(normalizePhone(raw)).toEqual({ ok: true, e164, extranjero: false });
  });

  it("marca los números extranjeros", () => {
    expect(normalizePhone("+44 20 7946 0958")).toMatchObject({ ok: true, extranjero: true });
  });

  it.each(["", "60011", "seis cero cero", "+34 500 000 000", "123456789"])(
    "rechaza %j",
    (raw) => {
      expect(normalizePhone(raw).ok).toBe(false);
    },
  );
});

describe("parseConsent", () => {
  it.each(["sí", "Si", "S", "true", "1", "yes", "X"])("%s → true", (v) => {
    expect(parseConsent(v)).toBe(true);
  });
  it.each(["no", "", "0", "false", "quizá"])("%j → false", (v) => {
    expect(parseConsent(v)).toBe(false);
  });
});

describe("parseFecha", () => {
  it("entiende el formato español", () => {
    expect(parseFecha("05/03/2026")).toBe("2026-03-05T12:00:00.000Z");
    expect(parseFecha("5-3-26")).toBe("2026-03-05T12:00:00.000Z");
    expect(parseFecha("05/03/2026 09:30")).toBe("2026-03-05T09:30:00.000Z");
  });
  it("entiende ISO", () => {
    expect(parseFecha("2026-03-05")).toBe("2026-03-05T12:00:00.000Z");
  });
  it("rechaza fechas imposibles o ambiguas", () => {
    expect(parseFecha("31/02/2026")).toBeNull();
    expect(parseFecha("2026-02-31")).toBeNull();
    expect(parseFecha("mañana")).toBeNull();
  });
});

describe("csv", () => {
  it("detecta cabeceras en español con acentos y alias", () => {
    expect(detectarMapeo(["Nombre", "Teléfono", "Correo electrónico", "Consentimiento", "Fecha consentimiento", "Origen", "Observaciones"])).toEqual({
      nombre: "Nombre",
      telefono: "Teléfono",
      email: "Correo electrónico",
      consentimiento: "Consentimiento",
      consentimiento_fecha: "Fecha consentimiento",
      consentimiento_origen: "Origen",
      notas: "Observaciones",
    });
  });

  it("decodifica archivos de Excel en Windows-1252", () => {
    const bytes = new Uint8Array([0x4d, 0x61, 0x72, 0xed, 0x61]); // "María" en cp1252
    expect(decodificar(bytes.buffer)).toBe("María");
  });

  it("acepta ',' y ';' como separador", () => {
    expect(parsearCsv("nombre,telefono\nAna,600112233").filas).toEqual([{ nombre: "Ana", telefono: "600112233" }]);
    expect(parsearCsv("nombre;telefono\r\nAna;600112233\r\n").filas).toEqual([{ nombre: "Ana", telefono: "600112233" }]);
  });
});

describe("validarFilas", () => {
  it("conserva la primera aparición y marca el resto como duplicado", () => {
    const filas = validarFilas(
      [
        { nombre: "Ana", telefono: "600112233" },
        { nombre: "Ana bis", telefono: "+34 600 11 22 33" },
      ],
      new Set(),
    );
    expect(filas.map((f) => f.estado)).toEqual(["valido", "duplicado_en_archivo"]);
    expect(filas[1].linea).toBe(3);
  });

  it("una fila inválida no bloquea el número para otra válida", () => {
    const filas = validarFilas(
      [
        { nombre: "", telefono: "600112233" },
        { nombre: "Ana", telefono: "600112233" },
      ],
      new Set(),
    );
    expect(filas.map((f) => f.estado)).toEqual(["falta_nombre", "valido"]);
  });

  it("descarta emails inválidos con aviso, sin bloquear la fila", () => {
    const [f] = validarFilas([{ nombre: "Ana", telefono: "600112233", email: "ana-arroba.com" }], new Set());
    expect(f.estado).toBe("valido");
    expect(f.contacto.email).toBeNull();
    expect(f.avisos).toContain("email_invalido");
  });
});

describe("criterio de aceptación 1: CSV de 50 contactos", () => {
  it("marca correctamente duplicados y teléfonos inválidos", () => {
    const buffer = readFileSync("scripts/fixtures/contactos-50.csv");
    const { headers, filas } = parsearCsv(decodificar(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)));
    const entrada = aplicarMapeo(filas, detectarMapeo(headers));
    const validadas = validarFilas(entrada, new Set(["+34699000001", "+34699000002"]));

    expect(resumir(validadas)).toEqual({
      total: 50,
      valido: 40,
      duplicado_en_archivo: 4,
      duplicado_en_bd: 2,
      telefono_invalido: 3,
      falta_nombre: 1,
      sinConsentimiento: 8,
    });
  });
});

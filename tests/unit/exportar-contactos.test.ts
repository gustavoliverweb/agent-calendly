import { describe, expect, it } from "vitest";
import { CAMPOS, aplicarMapeo, detectarMapeo, generarCsv, parsearCsv } from "@/lib/contacts/csv";
import { filaExportacion, type ContactoExportable } from "@/lib/contacts/exportar";
import { parseConsent, parseFecha } from "@/lib/contacts/parse";

const base: ContactoExportable = {
  nombre: "Ana López",
  telefono: "+34600112233",
  email: "ana@example.com",
  consentimiento: true,
  consentimiento_fecha: "2026-03-05T12:00:00Z",
  consentimiento_origen: "Formulario web",
  notas: "=HYPERLINK(\"http://x\")",
  organizacion: "Clínica Norte",
  cargo: "Gerente",
  sector: "Salud",
  web: "https://example.com",
  origen_datos: "Directorio público",
  estado: "cita_agendada",
  intentos: 2,
  ultimo_intento_en: "2026-11-18T09:30:00Z",
  requiere_seguimiento: false,
  seguimiento_motivo: null,
  no_llamar_en: null,
  creado_en: "2026-11-01T08:00:00Z",
};

describe("exportar contactos", () => {
  it("se vuelve a importar con el mapeo detectado automáticamente", () => {
    const csv = generarCsv([filaExportacion(base)]);
    const { headers, filas } = parsearCsv(csv.replace(/^﻿/, ""));
    const mapeo = detectarMapeo(headers);
    expect(Object.keys(mapeo).sort()).toEqual([...CAMPOS].sort());

    const [fila] = aplicarMapeo(filas, mapeo);
    expect(fila.nombre).toBe("Ana López");
    expect(fila.telefono).toBe("+34600112233");
    expect(parseConsent(fila.consentimiento)).toBe(true);
    expect(parseFecha(fila.consentimiento_fecha)?.slice(0, 10)).toBe("2026-03-05");
    expect(fila.origen_datos).toBe("Directorio público");
  });

  it("escapa fórmulas y muestra fechas y estado en español", () => {
    const fila = filaExportacion(base);
    expect(fila.Estado).toBe("Cita agendada");
    expect(fila["Último intento"]).toBe("18/11/2026 10:30");
    expect(generarCsv([fila])).toContain("\"'=HYPERLINK");
  });

  it("deja vacíos los opcionales", () => {
    const fila = filaExportacion({ ...base, email: null, consentimiento: false, consentimiento_fecha: null });
    expect(fila.Email).toBe("");
    expect(fila.Consentimiento).toBe("no");
    expect(fila["Fecha de consentimiento"]).toBe("");
  });
});

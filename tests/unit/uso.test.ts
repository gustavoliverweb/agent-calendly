import { describe, expect, it } from "vitest";
import {
  etiquetaMes,
  filaDetalleCsv,
  filaResumenCsv,
  importe,
  leerMes,
  mesActual,
  minutos,
  minutosTotales,
  sumarMeses,
} from "@/lib/uso/calculo";

// 17/11/2026 12:00 en Madrid.
const ahora = new Date("2026-11-17T11:00:00Z");

describe("meses", () => {
  it("el mes actual se calcula en hora de Madrid", () => {
    expect(mesActual(ahora)).toBe("2026-11-01");
    // 30/11 23:30 UTC ya es 1 de diciembre en Madrid.
    expect(mesActual(new Date("2026-11-30T23:30:00Z"))).toBe("2026-12-01");
  });

  it("lee el mes de la URL y cae en el actual si no vale o es futuro", () => {
    expect(leerMes("2026-10", ahora)).toBe("2026-10-01");
    expect(leerMes(undefined, ahora)).toBe("2026-11-01");
    expect(leerMes("2026-13", ahora)).toBe("2026-11-01");
    expect(leerMes("2026-12", ahora)).toBe("2026-11-01");
    expect(leerMes("2019-05", ahora)).toBe("2026-11-01");
    expect(leerMes(["2026-10"], ahora)).toBe("2026-11-01");
  });

  it("suma y resta meses cruzando el año", () => {
    expect(sumarMeses("2026-01-01", -1)).toBe("2025-12-01");
    expect(sumarMeses("2026-12-01", 1)).toBe("2027-01-01");
  });

  it("nombra el mes en español", () => {
    expect(etiquetaMes("2026-11-01")).toBe("noviembre de 2026");
  });
});

describe("minutos e importes", () => {
  it("minutos con un decimal y totales con pruebas", () => {
    expect(minutos(90)).toBe(1.5);
    expect(minutos(100)).toBe(1.7);
    expect(minutosTotales({ segundos: 120, segundos_pruebas: 60 })).toBe(3);
  });

  it("importe en céntimos y null sin tarifa", () => {
    expect(importe(3, 0.25)).toBe(0.75);
    expect(importe(10.1, 0.333)).toBe(3.36);
    expect(importe(3, null)).toBeNull();
    expect(importe(0, 0.25)).toBe(0);
  });
});

describe("filas CSV", () => {
  const uso = { llamadas: 2, contestadas: 1, citas: 1, citas_canceladas: 0, segundos: 120, pruebas: 1, segundos_pruebas: 60 };

  it("resumen con coma decimal, tarifa e importe", () => {
    const f = filaResumenCsv(
      "2026-11-01",
      { ...uso, nombre: "Empresa A", slug: "empresa-a", estado: "activa", precio_minuto: 0.25, limite_minutos_mes: null },
      0.12,
    );
    expect(f.Mes).toBe("2026-11");
    expect(f["Minutos totales"]).toBe("3,0");
    expect(f["Tarifa (EUR/min)"]).toBe("0,2500");
    expect(f["Importe estimado (EUR)"]).toBe("0,75");
    expect(f["Coste estimado ElevenLabs (USD)"]).toBe("0,36");
    expect(f["Límite minutos/mes"]).toBe("");
  });

  it("sin tarifa, importe vacío", () => {
    const f = filaResumenCsv(
      "2026-11-01",
      { ...uso, nombre: "B", slug: "b", estado: "activa", precio_minuto: null, limite_minutos_mes: 500 },
      0.12,
    );
    expect(f["Importe estimado (EUR)"]).toBe("");
    expect(f["Límite minutos/mes"]).toBe(500);
  });

  it("detalle sin datos personales y con la hora de Madrid", () => {
    const f = filaDetalleCsv({
      id: "abc",
      creado_en: "2026-11-17T09:05:00Z",
      estado: "completada",
      clasificacion: null,
      duracion_seg: 95,
      cita_agendada: true,
      es_prueba: false,
      lote_id: "lote",
    });
    expect(f).toEqual({
      "Fecha (Madrid)": "2026-11-17 10:05",
      Llamada: "abc",
      Tipo: "Lote",
      Estado: "Completada",
      Resultado: "",
      "Duración (s)": 95,
      Minutos: "1,6",
      Cita: "Sí",
    });
  });
});

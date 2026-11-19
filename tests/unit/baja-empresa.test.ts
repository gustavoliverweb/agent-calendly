import { describe, expect, it } from "vitest";
import { enParalelo, motivoNoBorrable, usoParaConservar, type CondicionesBorrado } from "@/lib/baja-empresa-reglas";

const lista: CondicionesBorrado = {
  estado: "suspendida",
  esPrincipal: false,
  llamadasEnCurso: 0,
  slug: "clinica-norte",
  confirmacion: "clinica-norte",
};

describe("motivoNoBorrable", () => {
  it("se puede borrar una empresa suspendida, sin llamadas y confirmada", () => {
    expect(motivoNoBorrable(lista)).toBeNull();
    expect(motivoNoBorrable({ ...lista, confirmacion: "  Clinica-Norte " })).toBeNull();
  });

  it.each<[string, Partial<CondicionesBorrado>, RegExp]>([
    ["la principal", { esPrincipal: true }, /principal/],
    ["una activa", { estado: "activa" }, /Suspende/],
    ["con llamadas en curso", { llamadasEnCurso: 1 }, /en curso/],
    ["sin confirmar", { confirmacion: "clinica" }, /identificador/],
    ["con confirmación vacía", { confirmacion: "" }, /identificador/],
  ])("no deja borrar %s", (_, cambio, motivo) => {
    expect(motivoNoBorrable({ ...lista, ...cambio })).toMatch(motivo);
  });
});

describe("usoParaConservar", () => {
  it("guarda solo los meses con actividad y convierte los segundos", () => {
    const filas = [
      { mes: "2026-11-01", llamadas: 3, contestadas: 2, citas: 1, segundos: "300", pruebas: 1, segundos_pruebas: "60" },
      { mes: "2026-10-01", llamadas: 0, contestadas: 0, citas: 0, segundos: 0, pruebas: 0, segundos_pruebas: 0 },
      { mes: "2026-09-01", llamadas: 0, contestadas: 0, citas: 0, segundos: 0, pruebas: 2, segundos_pruebas: 90 },
    ];
    expect(usoParaConservar(filas)).toEqual([
      { mes: "2026-11", llamadas: 3, contestadas: 2, citas: 1, segundos: 300, pruebas: 1, segundos_pruebas: 60 },
      { mes: "2026-09", llamadas: 0, contestadas: 0, citas: 0, segundos: 0, pruebas: 2, segundos_pruebas: 90 },
    ]);
  });
});

describe("enParalelo", () => {
  it("devuelve los que fallan sin pasar del máximo a la vez", async () => {
    let activos = 0;
    let pico = 0;
    const fallidos = await enParalelo([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      activos++;
      pico = Math.max(pico, activos);
      await new Promise((r) => setTimeout(r, 5));
      activos--;
      if (n % 3 === 0) throw new Error("falla");
    });
    expect(fallidos.sort()).toEqual([3, 6]);
    expect(pico).toBeLessThanOrEqual(3);
  });

  it("sin elementos no hace nada", async () => {
    expect(await enParalelo([], 5, async () => undefined)).toEqual([]);
  });
});

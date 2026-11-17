import { describe, expect, it } from "vitest";
import { solicitudSchema } from "@/lib/contenido/contacto";
import { RECURSOS } from "@/lib/contenido/recursos";
import { SOLUCIONES } from "@/lib/contenido/soluciones";

const base = { nombre: "Laura", email: "Laura@Clinica.ES", privacidad: "on" };

describe("formulario de contacto", () => {
  it("normaliza y deja en null lo que no se rellena", () => {
    expect(solicitudSchema.parse({ ...base, empresa: "  ", sector: "Inmobiliaria", origen: "/soluciones/clinicas" })).toEqual({
      nombre: "Laura",
      email: "laura@clinica.es",
      empresa: null,
      telefono: null,
      sector: "Inmobiliaria",
      volumen: null,
      mensaje: null,
      origen: "/soluciones/clinicas",
      privacidad: "on",
    });
  });

  it("exige aceptar la privacidad y un email válido", () => {
    expect(solicitudSchema.safeParse({ ...base, privacidad: undefined }).success).toBe(false);
    expect(solicitudSchema.safeParse({ ...base, email: "no-es-email" }).success).toBe(false);
    expect(solicitudSchema.safeParse({ ...base, nombre: " " }).success).toBe(false);
  });

  it("ignora sectores, volúmenes y orígenes que no son de la web", () => {
    const r = solicitudSchema.parse({ ...base, sector: "<script>", volumen: "un millón", origen: "https://otra.web/x" });
    expect(r).toMatchObject({ sector: null, volumen: null, origen: null });
  });

  it("cada solución preselecciona un sector válido del formulario", () => {
    for (const s of SOLUCIONES) {
      expect(solicitudSchema.parse({ ...base, sector: s.sector }).sector).toBe(s.sector);
    }
  });

  it("las páginas con slug llegan como origen válido y no repiten slug", () => {
    const rutas = [...SOLUCIONES.map((s) => `/soluciones/${s.slug}`), ...RECURSOS.map((r) => `/recursos/${r.slug}`)];
    expect(new Set(rutas).size).toBe(rutas.length);
    for (const origen of rutas) {
      expect(solicitudSchema.parse({ ...base, origen }).origen).toBe(origen);
    }
  });
});

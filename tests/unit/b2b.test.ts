import { describe, expect, it } from "vitest";
import { motivoCampana } from "@/lib/calls/config-form";
import { decidirResultado, leerDatosRecogidos, type Contexto, type EventoLlamada } from "@/lib/calls/outcome";
import { detectarMapeo } from "@/lib/contacts/csv";
import { resumir, validarFilas } from "@/lib/contacts/import";
import { problemasPrimerMensaje, renderPrimerMensaje } from "@/lib/guion/guion";
import { instruccionesModo } from "@/lib/guion/modo";

const ctx: Contexto = { citaAgendada: false, clasificacionPrevia: null, contactoEstado: "pendiente", intentos: 0, maxReintentos: 2 };
const fin = (datos: Extract<EventoLlamada, { tipo: "fin" }>["datos"]): EventoLlamada => ({ tipo: "fin", hablo: true, buzon: false, datos });

describe("motivoCampana", () => {
  it("comercial exige consentimiento; B2B, empresa y origen; no comercial, nada", () => {
    expect(motivoCampana("comercial", { consentimiento: false })).toBe("sin_consentimiento");
    expect(motivoCampana("no_comercial", { consentimiento: false })).toBeNull();
    expect(motivoCampana("b2b", { consentimiento: false, organizacion: "Acme", origen_datos: "web" })).toBeNull();
    expect(motivoCampana("b2b", { consentimiento: true, organizacion: "Acme", origen_datos: " " })).toBe("sin_datos_b2b");
    expect(motivoCampana("b2b", { consentimiento: true, organizacion: null, origen_datos: "web" })).toBe("sin_datos_b2b");
  });
});

describe("resultado de una llamada B2B", () => {
  it("si le pasan el nombre de otra persona: pasado a otra persona, con seguimiento y los datos", () => {
    const d = decidirResultado(
      fin({ hablo_con_decisor: false, nombre_contacto: "Ana López", cargo_contacto: "gerente", telefono_directo: "+34 600 00 00 00", mejor_momento: "martes por la mañana" }),
      ctx,
    );
    expect(d.llamada.clasificacion).toBe("pasado_a_otra_persona");
    expect(d.contacto).toEqual({
      tipo: "actualizar",
      campos: {
        estado: "llamado",
        intentos: 0,
        requiere_seguimiento: true,
        seguimiento_motivo: "pase: Ana López (gerente) · tel. +34 600 00 00 00 · mejor momento: martes por la mañana",
      },
    });
  });

  it("si no está quien decide y no dan otro contacto: decisor no disponible", () => {
    const d = decidirResultado(fin({ hablo_con_decisor: false, mejor_momento: "a partir de las 16:00" }), ctx);
    expect(d.llamada.clasificacion).toBe("decisor_no_disponible");
    expect(d.contacto).toMatchObject({ campos: { requiere_seguimiento: true, seguimiento_motivo: "decisor no disponible · mejor momento: a partir de las 16:00" } });
  });

  it("no llamar, cita y no interesado siguen mandando", () => {
    expect(decidirResultado(fin({ hablo_con_decisor: false, pide_no_llamar: true }), ctx).llamada.clasificacion).toBe("no_llamar");
    expect(decidirResultado(fin({ hablo_con_decisor: false }), { ...ctx, citaAgendada: true }).llamada.clasificacion).toBe("cita_agendada");
    expect(decidirResultado(fin({ hablo_con_decisor: false, interes: "no" }), ctx).llamada.clasificacion).toBe("no_interesado");
  });

  it("habló con quien decide: reglas de siempre", () => {
    expect(decidirResultado(fin({ hablo_con_decisor: true, pide_rellamada: true }), ctx).llamada.clasificacion).toBe("rellamar");
  });

  it("lee los datos B2B del análisis", () => {
    expect(
      leerDatosRecogidos({
        hablo_con_decisor: { value: "false" },
        nombre_contacto: { value: " Ana " },
        cargo_contacto: { value: "" },
        telefono_directo: { value: "600000000" },
      }),
    ).toMatchObject({ hablo_con_decisor: false, nombre_contacto: "Ana", cargo_contacto: undefined, telefono_directo: "600000000" });
  });
});

describe("primer mensaje y modo", () => {
  it("acepta {empresa} y {cargo} y no deja huecos si faltan", () => {
    expect(problemasPrimerMensaje("Hola, ¿me pasa con {nombre}, {cargo} de {empresa}? Soy una asistente virtual y la llamada se transcribe.")).toEqual([]);
    expect(renderPrimerMensaje("¿Me pasa con {nombre}, {cargo}?", { nombre: "Ana", negocio: "X", agente: "C", cargo: "gerente" })).toBe("¿Me pasa con Ana, gerente?");
    expect(renderPrimerMensaje("Hola {nombre} {cargo}, de {empresa}.", { nombre: "Ana", negocio: "X", agente: "C" })).toBe("Hola Ana, de.");
  });

  it("instrucciones B2B con la persona, el cargo y la empresa", () => {
    const t = instruccionesModo("b2b", { nombre: "Ana López", cargo: "gerente", organizacion: "Acme SL" });
    expect(t).toContain("Llamas a una empresa de Acme SL");
    expect(t).toContain("Ana López (gerente)");
    expect(t).toContain("no_llamar");
    expect(instruccionesModo("b2c", { nombre: "Laura" })).toContain("particular: Laura");
  });
});

describe("importación B2B", () => {
  it("detecta las columnas de empresa", () => {
    expect(detectarMapeo(["Nombre", "Teléfono", "Empresa", "Puesto", "Sitio web", "Origen de los datos"])).toMatchObject({
      organizacion: "Empresa",
      cargo: "Puesto",
      web: "Sitio web",
      origen_datos: "Origen de los datos",
    });
  });

  it("guarda los datos de empresa recortados y cuenta los que no podrán llamarse en B2B", () => {
    const filas = validarFilas(
      [
        { nombre: "Recepción Acme", telefono: "910000001", organizacion: "Acme SL", origen_datos: "web", cargo: "x".repeat(200) },
        { nombre: "Beta", telefono: "910000002", organizacion: "Beta SA" },
      ],
      new Set(),
    );
    expect(filas[0].contacto).toMatchObject({ organizacion: "Acme SL", origen_datos: "web" });
    expect(filas[0].contacto.cargo).toHaveLength(120);
    expect(resumir(filas).sinDatosB2b).toBe(1);
  });
});

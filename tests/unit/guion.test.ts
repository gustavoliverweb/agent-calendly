import { describe, expect, it } from "vitest";
import {
  MAX_TEXTO,
  guionFormSchema,
  montarGuion,
  problemasPrimerMensaje,
  renderPrimerMensaje,
  variablesGuion,
  type GuionForm,
} from "@/lib/guion/guion";

const base: GuionForm = {
  negocio_nombre: "Clínica Sonrisa",
  nombre_agente: "Clara",
  primer_mensaje:
    "Hola, ¿hablo con {nombre}? Le llamo de {negocio}. Soy {agente}, una asistente virtual con inteligencia artificial, y esta llamada se transcribe para gestionar su cita.",
  voz_id: null,
  negocio: "Clínica dental.",
  motivo:
    "La persona pidió información en la web sobre una limpieza o revisión dental. Si pregunta de dónde tenemos su número: lo dejó al pedir información en el formulario de la web.",
  oferta: "Una primera visita gratuita de 30 minutos, con revisión y presupuesto sin compromiso.",
  cita: "En la clínica, calle Mayor 10, Madrid. Dura unos 30 minutos.",
  preguntas:
    "¿Cuánto cuesta? La primera visita es gratuita. Los precios de cada tratamiento se los dará el dentista en la visita.\n¿Hay que llevar algo? Solo el DNI y, si tiene, informes dentales anteriores.",
  objeciones: "",
  limites: "No des precios de tratamientos ni diagnósticos.",
};

describe("montarGuion", () => {
  it("coincide con el guion inicial de la migración 20261114000000_guiones.sql", () => {
    expect(montarGuion(base)).toBe(
      "Negocio: Clínica Sonrisa\n\n" +
        "A qué se dedica:\nClínica dental.\n\n" +
        "Motivo de la llamada:\nLa persona pidió información en la web sobre una limpieza o revisión dental. Si pregunta de dónde tenemos su número: lo dejó al pedir información en el formulario de la web.\n\n" +
        "Oferta:\nUna primera visita gratuita de 30 minutos, con revisión y presupuesto sin compromiso.\n\n" +
        "La cita:\nEn la clínica, calle Mayor 10, Madrid. Dura unos 30 minutos.\n\n" +
        "Preguntas frecuentes:\n¿Cuánto cuesta? La primera visita es gratuita. Los precios de cada tratamiento se los dará el dentista en la visita.\n¿Hay que llevar algo? Solo el DNI y, si tiene, informes dentales anteriores.\n\n" +
        "Lo que no debes decir:\nNo des precios de tratamientos ni diagnósticos.",
    );
  });

  it("omite apartados vacíos y quita llaves dobles", () => {
    const texto = montarGuion({ ...base, preguntas: "   ", limites: "", objeciones: "Usa {{nombre}} al despedirte" });
    expect(texto).not.toContain("Preguntas frecuentes");
    expect(texto).not.toContain("{{");
    expect(texto).toContain("Objeciones propias del negocio:\nUsa {nombre} al despedirte");
  });
});

describe("problemasPrimerMensaje", () => {
  it("acepta el mensaje de ejemplo", () => {
    expect(problemasPrimerMensaje(base.primer_mensaje)).toEqual([]);
  });

  it("exige identificarse como IA y avisar de la transcripción", () => {
    const p = problemasPrimerMensaje("Hola, ¿hablo con {nombre}? Le llamo de {negocio}.");
    expect(p).toHaveLength(2);
  });

  it("no depende de tildes ni mayúsculas", () => {
    expect(problemasPrimerMensaje("Soy una INTELIGENCIA ARTIFICIAL y la llamada se GRABA.")).toEqual([]);
  });

  it("rechaza marcadores desconocidos", () => {
    const p = problemasPrimerMensaje("Hola {telefono}, soy una asistente virtual y esta llamada se transcribe.");
    expect(p.join(" ")).toContain("{telefono}");
  });
});

describe("guionFormSchema", () => {
  it("valida el guion de ejemplo", () => {
    expect(guionFormSchema.safeParse(base).success).toBe(true);
  });

  it("exige los apartados obligatorios", () => {
    const r = guionFormSchema.safeParse({ ...base, oferta: "  " });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain("Oferta");
  });

  it("rechaza un primer mensaje que no dice que es una IA", () => {
    const r = guionFormSchema.safeParse({ ...base, primer_mensaje: "Hola, le llamo de {negocio}, esta llamada se transcribe." });
    expect(r.success).toBe(false);
  });

  it("rechaza voces fuera de la lista", () => {
    expect(guionFormSchema.safeParse({ ...base, voz_id: "no/válida" }).success).toBe(false);
  });

  it("limita el tamaño total del guion", () => {
    const largo = "x".repeat(1400);
    const r = guionFormSchema.safeParse({
      ...base,
      negocio: largo,
      motivo: "y".repeat(1000),
      oferta: largo,
      cita: "z".repeat(800),
      preguntas: "p".repeat(3000),
      objeciones: "o".repeat(2000),
      limites: "l".repeat(1500),
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain(String(MAX_TEXTO));
  });
});

describe("renderPrimerMensaje / variablesGuion", () => {
  it("sustituye los marcadores", () => {
    expect(renderPrimerMensaje("Hola { nombre }, soy {agente} de {negocio}", { nombre: "Ana", negocio: "X", agente: "Clara" })).toBe(
      "Hola Ana, soy Clara de X",
    );
  });

  it("devuelve las variables que usa el prompt fijo", () => {
    const v = variablesGuion(
      { negocio_nombre: "Clínica Sonrisa", nombre_agente: "Clara", primer_mensaje: base.primer_mensaje, texto: "T", voz_id: null },
      "Alfredo",
    );
    expect(v).toEqual({
      negocio: "Clínica Sonrisa",
      nombre_agente: "Clara",
      guion_negocio: "T",
      primer_mensaje:
        "Hola, ¿hablo con Alfredo? Le llamo de Clínica Sonrisa. Soy Clara, una asistente virtual con inteligencia artificial, y esta llamada se transcribe para gestionar su cita.",
    });
  });
});

import { describe, expect, it } from "vitest";
import { ahoraEnTexto } from "@/lib/calls/launch";
import { configuracionFormSchema } from "@/lib/calls/config-form";
import {
  decidirItemLote,
  decidirResultado,
  esBuzon,
  leerDatosRecogidos,
  type Contexto,
  type EventoLlamada,
} from "@/lib/calls/outcome";
import { webhookElevenLabsSchema } from "@/lib/calls/post-call";
import { contarItems } from "@/lib/lotes/estados";
import { describirFranjas, estaEnFranja, franjasSchema, siguienteInicioFranja, type Calendario } from "@/lib/calls/window";

const cal: Calendario = {
  franjas: [
    { dias: [1, 2, 3, 4, 5], desde: "10:00", hasta: "14:00" },
    { dias: [1, 2, 3, 4, 5], desde: "16:00", hasta: "20:00" },
  ],
  festivos: ["2026-12-08"],
};
const iso = (s: string) => new Date(s);

describe("franjas horarias (hora de Madrid)", () => {
  it.each([
    ["2026-10-23T07:59:00Z", false], // viernes 09:59
    ["2026-10-23T08:00:00Z", true], // viernes 10:00 (inicio incluido)
    ["2026-10-23T11:59:00Z", true], // 13:59
    ["2026-10-23T12:00:00Z", false], // 14:00 (fin excluido)
    ["2026-10-23T14:00:00Z", true], // 16:00
    ["2026-10-23T18:00:00Z", false], // 20:00
    ["2026-10-24T09:00:00Z", false], // sábado 11:00
    ["2026-10-26T09:00:00Z", true], // lunes 10:00 en horario de invierno (UTC+1)
    ["2026-10-26T08:30:00Z", false], // lunes 09:30 en invierno
    ["2026-12-08T10:00:00Z", false], // martes festivo
  ])("%s → %s", (t, esperado) => {
    expect(estaEnFranja(iso(t), cal)).toBe(esperado);
  });

  it("siguiente inicio: el mismo instante si ya está en franja", () => {
    const t = iso("2026-10-23T09:00:00Z");
    expect(siguienteInicioFranja(t, cal)).toEqual(t);
  });

  it("siguiente inicio: la franja de tarde del mismo día", () => {
    expect(siguienteInicioFranja(iso("2026-10-23T12:30:00Z"), cal)).toEqual(iso("2026-10-23T14:00:00Z"));
  });

  it("siguiente inicio: salta el fin de semana y el cambio de horario", () => {
    // Viernes 20:30 → lunes 26 a las 10:00 CET = 09:00 UTC.
    expect(siguienteInicioFranja(iso("2026-10-23T18:30:00Z"), cal)).toEqual(iso("2026-10-26T09:00:00Z"));
  });

  it("siguiente inicio: salta festivos", () => {
    // Lunes 7/12 a las 21:00 → el martes 8 es festivo → miércoles 9 a las 10:00.
    expect(siguienteInicioFranja(iso("2026-12-07T20:00:00Z"), cal)).toEqual(iso("2026-12-09T09:00:00Z"));
  });

  it("sin franjas no hay siguiente inicio", () => {
    expect(siguienteInicioFranja(iso("2026-10-23T09:00:00Z"), { franjas: [], festivos: [] })).toBeNull();
  });

  it("valida el formato de las franjas", () => {
    expect(franjasSchema.safeParse(cal.franjas).success).toBe(true);
    expect(franjasSchema.safeParse([{ dias: [1], desde: "14:00", hasta: "10:00" }]).success).toBe(false);
    expect(franjasSchema.safeParse([{ dias: [8], desde: "10:00", hasta: "14:00" }]).success).toBe(false);
    expect(franjasSchema.safeParse([{ dias: [1], desde: "9:00", hasta: "14:00" }]).success).toBe(false);
  });

  it("describe las franjas para mensajes", () => {
    expect(describirFranjas(cal.franjas)).toBe("L–V 10:00–14:00 · L–V 16:00–20:00");
    expect(describirFranjas([{ dias: [6, 1], desde: "09:00", hasta: "12:00" }])).toBe("L,S 09:00–12:00");
  });

  it("fecha y hora actuales en texto para el agente", () => {
    expect(ahoraEnTexto(iso("2026-10-23T09:15:00Z"))).toBe("viernes 23 de octubre de 2026, 11:15");
  });
});

describe("decidirResultado (§7.2)", () => {
  const ctx = (c: Partial<Contexto> = {}): Contexto => ({
    citaAgendada: false,
    clasificacionPrevia: null,
    contactoEstado: "pendiente",
    intentos: 0,
    maxReintentos: 2,
    ...c,
  });
  const fin = (datos: Partial<Extract<EventoLlamada, { tipo: "fin" }>> = {}): EventoLlamada => ({
    tipo: "fin",
    hablo: true,
    buzon: false,
    datos: {},
    ...datos,
  });

  it("1. pide no ser llamado → no_llamar (gana a todo, incluso a una cita)", () => {
    const d = decidirResultado(fin({ datos: { pide_no_llamar: true, interes: "no" } }), ctx({ citaAgendada: true }));
    expect(d.llamada).toEqual({ estado: "completada", clasificacion: "no_llamar" });
    expect(d.contacto).toEqual({ tipo: "no_llamar" });
  });

  it("1. la tool no_llamar durante la llamada también cuenta", () => {
    const d = decidirResultado(fin(), ctx({ clasificacionPrevia: "no_llamar" }));
    expect(d.contacto).toEqual({ tipo: "no_llamar" });
  });

  it("2. cita reservada → cita_agendada", () => {
    const d = decidirResultado(fin({ datos: { interes: "si" } }), ctx({ citaAgendada: true }));
    expect(d.llamada.clasificacion).toBe("cita_agendada");
    expect(d.contacto).toEqual({ tipo: "actualizar", campos: { estado: "cita_agendada", intentos: 0 } });
  });

  it("3. no le interesa → no_interesado", () => {
    const d = decidirResultado(fin({ datos: { interes: "no" } }), ctx());
    expect(d.llamada.clasificacion).toBe("no_interesado");
    expect(d.contacto).toEqual({ tipo: "actualizar", campos: { estado: "no_interesado", intentos: 0 } });
  });

  it("4. no contesta: suma intento y mantiene estado mientras queden reintentos", () => {
    const d = decidirResultado({ tipo: "fallo_inicio", motivo: "no-answer" }, ctx({ intentos: 1 }));
    expect(d.llamada).toEqual({ estado: "fallida", clasificacion: "sin_respuesta" });
    expect(d.contacto).toEqual({ tipo: "actualizar", campos: { intentos: 2 } });
    expect(d.sinRespuesta).toBe(true);
  });

  it("4. agotados (1 inicial + 2 reintentos) → no_contesta", () => {
    const d = decidirResultado({ tipo: "fallo_inicio", motivo: "busy" }, ctx({ intentos: 2 }));
    expect(d.contacto).toEqual({ tipo: "actualizar", campos: { intentos: 3, estado: "no_contesta" } });
  });

  it("4. buzón de voz cuenta como no contestado", () => {
    const d = decidirResultado(fin({ buzon: true, hablo: false }), ctx());
    expect(d.llamada).toEqual({ estado: "buzon", clasificacion: "buzon" });
    expect(d.sinRespuesta).toBe(true);
  });

  it("4. descolgó pero nadie habló → sin respuesta", () => {
    const d = decidirResultado(fin({ hablo: false }), ctx());
    expect(d.llamada).toEqual({ estado: "completada", clasificacion: "sin_respuesta" });
    expect(d.sinRespuesta).toBe(true);
  });

  it("4. no baja a no_contesta a quien ya no estaba pendiente", () => {
    const d = decidirResultado({ tipo: "fallo_inicio", motivo: "busy" }, ctx({ intentos: 5, contactoEstado: "no_interesado" }));
    expect(d.contacto).toEqual({ tipo: "actualizar", campos: { intentos: 6 } });
  });

  it("5. pide rellamada → llamado + seguimiento con el momento", () => {
    const d = decidirResultado(fin({ datos: { pide_rellamada: true, momento_rellamada: "el jueves por la tarde" } }), ctx());
    expect(d.llamada.clasificacion).toBe("rellamar");
    expect(d.contacto).toEqual({
      tipo: "actualizar",
      campos: { estado: "llamado", intentos: 0, requiere_seguimiento: true, seguimiento_motivo: "rellamar: el jueves por la tarde" },
    });
  });

  it("5. habló sin resultado concreto → llamado", () => {
    const d = decidirResultado(fin({ datos: { interes: "dudoso" } }), ctx());
    expect(d.llamada.clasificacion).toBe("otro");
    expect(d.contacto).toEqual({ tipo: "actualizar", campos: { estado: "llamado", intentos: 0 } });
  });

  it("no baja de cita_agendada a llamado en una llamada de seguimiento", () => {
    const d = decidirResultado(fin(), ctx({ contactoEstado: "cita_agendada" }));
    expect(d.contacto).toEqual({ tipo: "actualizar", campos: { estado: "cita_agendada", intentos: 0 } });
  });

  it("nunca toca a un contacto ya excluido", () => {
    const d = decidirResultado({ tipo: "fallo_inicio", motivo: "busy" }, ctx({ contactoEstado: "no_llamar" }));
    expect(d.contacto).toEqual({ tipo: "ninguno" });
  });
});

describe("lectura del análisis de ElevenLabs", () => {
  it("normaliza los valores de data collection", () => {
    expect(
      leerDatosRecogidos({
        interes: { data_collection_id: "interes", value: "No", rationale: "…" },
        pide_rellamada: { value: "true" },
        momento_rellamada: { value: "  mañana  " },
        pide_no_llamar: { value: false },
        motivo_rechazo: { value: null },
      }),
    ).toEqual({
      interes: "no",
      pide_rellamada: true,
      momento_rellamada: "mañana",
      pide_no_llamar: false,
      motivo_rechazo: undefined,
    });
  });

  it("interés: sí/yes → si; otros textos → dudoso; ausente → undefined", () => {
    expect(leerDatosRecogidos({ interes: { value: "Sí" } }).interes).toBe("si");
    expect(leerDatosRecogidos({ interes: { value: "yes" } }).interes).toBe("si");
    expect(leerDatosRecogidos({ interes: { value: "quizás" } }).interes).toBe("dudoso");
    expect(leerDatosRecogidos({}).interes).toBeUndefined();
    expect(leerDatosRecogidos(null)).toEqual({});
  });

  it("detecta el buzón", () => {
    expect(esBuzon("Voicemail detected", null)).toBe(true);
    expect(esBuzon(null, "voicemail")).toBe(true);
    expect(esBuzon("end_call tool was called", "answered")).toBe(false);
  });
});

describe("item de lote al terminar su llamada (§7.3)", () => {
  const config = { ...cal, horas_entre_reintentos: 24 };
  const sin = { tipo: "fallo_inicio", motivo: "no-answer" } as const;
  const ctx = (intentos: number): Contexto => ({
    citaAgendada: false,
    clasificacionPrevia: null,
    contactoEstado: "pendiente",
    intentos,
    maxReintentos: 2,
  });

  it("los reintentos se agotan en el intento 1 + max_reintentos", () => {
    expect(decidirResultado(sin, ctx(0)).reintentosAgotados).toBe(false);
    expect(decidirResultado(sin, ctx(1)).reintentosAgotados).toBe(false);
    expect(decidirResultado(sin, ctx(2)).reintentosAgotados).toBe(true);
  });

  it("contestó (con o sin resultado) → completado", () => {
    const d = decidirResultado({ tipo: "fin", hablo: true, buzon: false, datos: {} }, ctx(0));
    expect(decidirItemLote(d, iso("2026-10-23T09:00:00Z"), config)).toEqual({
      estado: "completado",
      proximo_intento_en: null,
      motivo_omision: null,
    });
  });

  it("sin respuesta → reintento a las 24 h si cae en franja", () => {
    // viernes 11:00 → +24 h = sábado: salta al lunes 10:00 (ya en horario de invierno, UTC+1)
    const r = decidirItemLote(decidirResultado(sin, ctx(0)), iso("2026-10-23T09:00:00Z"), config);
    expect(r).toEqual({ estado: "esperando_reintento", proximo_intento_en: "2026-10-26T09:00:00.000Z", motivo_omision: null });
  });

  it("sin respuesta un lunes → el martes a la misma hora", () => {
    const r = decidirItemLote(decidirResultado(sin, ctx(0)), iso("2026-10-26T10:30:00Z"), config);
    expect(r.proximo_intento_en).toBe("2026-10-27T10:30:00.000Z");
  });

  it("sin reintentos → fallido por no contesta", () => {
    expect(decidirItemLote(decidirResultado(sin, ctx(2)), iso("2026-10-23T09:00:00Z"), config)).toEqual({
      estado: "fallido",
      proximo_intento_en: null,
      motivo_omision: "no_contesta",
    });
  });

  it("sin ninguna franja futura → fallido por sin_franja", () => {
    const r = decidirItemLote(decidirResultado(sin, ctx(0)), iso("2026-10-23T09:00:00Z"), { ...config, franjas: [] });
    expect(r).toMatchObject({ estado: "fallido", motivo_omision: "sin_franja" });
  });

  it("cuenta los items por estado", () => {
    const p = contarItems([{ estado: "en_cola" }, { estado: "en_cola" }, { estado: "completado" }]);
    expect(p).toMatchObject({ total: 3, en_cola: 2, completado: 1, fallido: 0 });
  });
});

describe("formulario de configuración", () => {
  const base = {
    max_concurrencia: 2,
    franjas: cal.franjas,
    festivos: ["2026-12-25", "2026-12-08", "2026-12-25"],
    max_reintentos: 2,
    horas_entre_reintentos: 24,
    tipo_campana: "comercial" as const,
    timeout_llamada_min: 15,
  };

  it("ordena y quita festivos repetidos", () => {
    const r = configuracionFormSchema.parse(base);
    expect(r.festivos).toEqual(["2026-12-08", "2026-12-25"]);
  });

  it.each([
    [{ max_concurrencia: 0 }],
    [{ max_concurrencia: 11 }],
    [{ franjas: [] }],
    [{ franjas: [{ dias: [1], desde: "14:00", hasta: "10:00" }] }],
    [{ franjas: [{ dias: [], desde: "10:00", hasta: "14:00" }] }],
    [{ festivos: ["25/12/2026"] }],
    [{ horas_entre_reintentos: 0 }],
    [{ timeout_llamada_min: Number.NaN }],
  ])("rechaza %o", (cambio) => {
    expect(configuracionFormSchema.safeParse({ ...base, ...cambio }).success).toBe(false);
  });
});

describe("esquema del webhook de ElevenLabs", () => {
  it("acepta un análisis sin criterios de evaluación ni datos recogidos", () => {
    const r = webhookElevenLabsSchema.safeParse({
      type: "post_call_transcription",
      data: { conversation_id: "c1", transcript: [], analysis: { transcript_summary: "x" } },
    });
    expect(r.success).toBe(true);
  });

  it("acepta la forma mínima de un fallo al iniciar", () => {
    const r = webhookElevenLabsSchema.safeParse({
      type: "call_initiation_failure",
      data: { conversation_id: "c1", failure_reason: "busy" },
    });
    expect(r.success).toBe(true);
  });
});

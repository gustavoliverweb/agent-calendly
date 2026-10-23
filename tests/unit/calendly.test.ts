import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calcularRango, invalidarDisponibilidad } from "@/lib/calendly/availability";
import { calendlyFetch, CalendlyError, clasificarError } from "@/lib/calendly/client";
import { formatearHueco, unirOpciones } from "@/lib/calendly/format-es";
import { seleccionarHuecos } from "@/lib/calendly/slots";
import { consultarDisponibilidad } from "@/lib/tools/disponibilidad";
import { normalizarEmail } from "@/lib/tools/agendar";
import { fechaMadrid, madridAUtc, partesMadrid } from "@/lib/time/madrid";

const iso = (s: string) => new Date(s);

describe("hora de Madrid", () => {
  it("convierte hora de pared a UTC en verano e invierno", () => {
    expect(madridAUtc(2026, 10, 23, 11).toISOString()).toBe("2026-10-23T09:00:00.000Z"); // CEST
    expect(madridAUtc(2026, 10, 26, 11).toISOString()).toBe("2026-10-26T10:00:00.000Z"); // CET
  });

  it("resuelve el cambio de horario de octubre (hora repetida) y de marzo (hora saltada)", () => {
    // 25/10/2026: las 02:30 ocurren dos veces; se toma la primera (CEST).
    expect(madridAUtc(2026, 10, 25, 2, 30).toISOString()).toBe("2026-10-25T00:30:00.000Z");
    // 28/03/2027: las 02:30 no existen; se pasa a las 03:30 CEST.
    const saltada = madridAUtc(2027, 3, 28, 2, 30);
    expect(saltada.toISOString()).toBe("2027-03-28T01:30:00.000Z");
    expect(partesMadrid(saltada)).toMatchObject({ hora: 3, minuto: 30 });
  });

  it("da el día y el día de la semana de Madrid, no de UTC", () => {
    // 23:30 UTC del jueves ya es viernes en Madrid.
    expect(fechaMadrid(iso("2026-10-22T23:30:00Z"))).toBe("2026-10-23");
    expect(partesMadrid(iso("2026-10-22T23:30:00Z")).diaSemana).toBe(5);
  });
});

describe("formatearHueco", () => {
  const ahora = iso("2026-10-22T08:00:00Z"); // jueves 22, 10:00 en Madrid

  it.each([
    ["2026-10-22T15:30:00Z", "hoy a las 17:30"],
    ["2026-10-23T09:00:00Z", "mañana viernes 23 a las 11:00"],
    ["2026-10-26T10:00:00Z", "lunes 26 a las 11:00"], // ya en horario de invierno
    ["2026-11-02T09:00:00Z", "lunes 2 de noviembre a las 10:00"],
    ["2026-10-30T07:05:00Z", "viernes 30 a las 08:05"],
  ])("%s → %s", (inicio, texto) => {
    expect(formatearHueco(iso(inicio), ahora)).toBe(texto);
  });

  it("usa el día de Madrid para decidir hoy/mañana pasada la medianoche UTC", () => {
    const tarde = iso("2026-10-22T21:00:00Z"); // jueves 23:00 en Madrid
    expect(formatearHueco(iso("2026-10-22T22:30:00Z"), tarde)).toBe("mañana viernes 23 a las 00:30");
  });

  it("une opciones como se dicen", () => {
    expect(unirOpciones(["a"])).toBe("a");
    expect(unirOpciones(["a", "b"])).toBe("a o b");
    expect(unirOpciones(["a", "b", "c"])).toBe("a, b o c");
  });
});

describe("seleccionarHuecos", () => {
  // Madrid = UTC+2 en estas fechas.
  const h = (dia: number, hora: number, min = 0) => new Date(Date.UTC(2026, 9, dia, hora - 2, min));

  it("no ofrece tres huecos seguidos de la misma mañana", () => {
    const libres = [h(23, 10), h(23, 10, 30), h(23, 11), h(23, 11, 30), h(26, 10), h(26, 17)];
    const elegidos = seleccionarHuecos(libres);
    expect(elegidos).toHaveLength(3);
    expect(new Set(elegidos.map(fechaMadrid)).size).toBeGreaterThan(1);
  });

  it("prefiere días distintos y alterna mañana y tarde", () => {
    const libres = [h(23, 10), h(23, 17), h(26, 10), h(26, 18), h(27, 10), h(27, 16)];
    expect(seleccionarHuecos(libres)).toEqual([h(23, 10), h(26, 18), h(27, 10)]);
  });

  it("con un solo día, combina mañana y tarde y completa con lo más próximo", () => {
    const libres = [h(23, 10), h(23, 10, 30), h(23, 11), h(23, 17)];
    expect(seleccionarHuecos(libres)).toEqual([h(23, 10), h(23, 10, 30), h(23, 17)]);
  });

  it("es determinista aunque la entrada venga desordenada", () => {
    const libres = [h(27, 10), h(23, 17), h(26, 10), h(23, 10)];
    expect(seleccionarHuecos(libres)).toEqual(seleccionarHuecos([...libres].reverse()));
  });

  it("devuelve lo que haya si hay menos de tres", () => {
    expect(seleccionarHuecos([h(23, 10)])).toEqual([h(23, 10)]);
    expect(seleccionarHuecos([])).toEqual([]);
  });
});

describe("calcularRango", () => {
  const ahora = iso("2026-10-22T08:07:00Z"); // jueves 10:07 en Madrid

  it("sin fechas: desde ahora + 2 h (redondeado a 15 min) durante 7 días", () => {
    const r = calcularRango(undefined, undefined, ahora);
    expect(r).toEqual({ inicio: iso("2026-10-22T10:15:00Z"), fin: iso("2026-10-29T10:15:00Z") });
  });

  it("interpreta las fechas como días completos de Madrid", () => {
    const r = calcularRango("2026-10-26", "2026-10-27", ahora);
    // 26/10 00:00 CET = 25/10 23:00 UTC; hasta el final del 27.
    expect(r).toEqual({ inicio: iso("2026-10-25T23:00:00Z"), fin: iso("2026-10-27T23:00:00Z") });
  });

  it("si el día pedido es hoy, empieza en ahora + margen", () => {
    const r = calcularRango("2026-10-22", "2026-10-22", ahora);
    expect(r).toEqual({ inicio: iso("2026-10-22T10:15:00Z"), fin: iso("2026-10-22T22:00:00Z") });
  });

  it("limita el rango a 31 días", () => {
    const r = calcularRango("2026-11-01", "2027-03-01", ahora);
    if ("error" in r) throw new Error(r.error);
    expect((r.fin.getTime() - r.inicio.getTime()) / 86_400_000).toBe(31);
  });

  it.each([
    ["22/10/2026", undefined, "fecha_invalida"],
    ["2026-02-30", undefined, "fecha_invalida"],
    ["2026-10-01", "2026-10-10", "rango_pasado"],
    ["2026-10-28", "2026-10-25", "rango_invertido"],
  ])("desde=%s hasta=%s → %s", (desde, hasta, error) => {
    expect(calcularRango(desde, hasta, ahora)).toEqual({ error });
  });
});

describe("clasificarError", () => {
  it.each([
    [401, {}, "auth"],
    [403, { title: "Permission Denied" }, "auth"],
    [429, {}, "temporal"],
    [503, {}, "temporal"],
    [400, { message: "The selected time is no longer available." }, "hueco_no_disponible"],
    [400, { details: [{ parameter: "start_time", message: "invalid" }] }, "hueco_no_disponible"],
    [400, { details: [{ parameter: "questions_and_answers", message: "required" }] }, "validacion"],
    [404, { message: "Resource Not Found" }, "validacion"],
  ] as const)("%i %j → %s", (status, cuerpo, tipo) => {
    expect(clasificarError(status, cuerpo)).toBe(tipo);
  });
});

describe("normalizarEmail", () => {
  it("quita espacios del dictado y pasa a minúsculas", () => {
    expect(normalizarEmail(" Maria.Lopez @ Gmail . com ")).toBe("maria.lopez@gmail.com");
  });
});

describe("Calendly con fetch simulado", () => {
  const ahora = iso("2026-10-22T08:00:00Z");
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("CALENDLY_TOKEN", "token-de-prueba-123456");
    vi.stubEnv("CALENDLY_EVENT_TYPE_URI", "https://api.calendly.com/event_types/TEST");
    vi.stubGlobal("fetch", fetchMock);
    invalidarDisponibilidad();
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const disponibles = (...isos: string[]) =>
    Response.json({ collection: isos.map((start_time) => ({ status: "available", invitees_remaining: 1, start_time })) });

  it("envía token y parámetros y devuelve 3 huecos con texto", async () => {
    fetchMock.mockResolvedValueOnce(
      disponibles("2026-10-23T08:00:00Z", "2026-10-23T08:30:00Z", "2026-10-23T15:00:00Z", "2026-10-26T09:00:00Z"),
    );
    const r = await consultarDisponibilidad({}, ahora);

    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(String(url));
    expect(u.pathname).toBe("/event_type_available_times");
    expect(u.searchParams.get("event_type")).toBe("https://api.calendly.com/event_types/TEST");
    expect(u.searchParams.get("start_time")).toBe("2026-10-22T10:00:00.000Z");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-de-prueba-123456");

    expect(r.error).toBeUndefined();
    expect(r.huecos.map((x) => x.texto)).toEqual([
      "mañana viernes 23 a las 10:00",
      "mañana viernes 23 a las 17:00",
      "lunes 26 a las 10:00",
    ]);
    expect(r.huecos[0].start_time).toBe("2026-10-23T08:00:00.000Z");
    expect(r.mensaje).toBe(
      "Hay estos huecos disponibles: mañana viernes 23 a las 10:00, mañana viernes 23 a las 17:00 o lunes 26 a las 10:00.",
    );
  });

  it("cachea la consulta del mismo rango", async () => {
    fetchMock.mockResolvedValueOnce(disponibles("2026-10-23T08:00:00Z"));
    await consultarDisponibilidad({}, ahora);
    await consultarDisponibilidad({}, ahora);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sin huecos devuelve un mensaje útil", async () => {
    fetchMock.mockResolvedValueOnce(disponibles());
    const r = await consultarDisponibilidad({ desde: "2026-10-24", hasta: "2026-10-25" }, ahora);
    expect(r).toEqual({ huecos: [], mensaje: "No hay huecos libres entre esas fechas. Puedes proponer otras fechas." });
  });

  it("si Calendly falla, pide ofrecer rellamada y no cachea el error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    const r = await consultarDisponibilidad({}, ahora);
    expect(r.error).toBe("calendario_no_disponible");
    expect(r.mensaje).toMatch(/llamemos más tarde/);

    fetchMock.mockResolvedValueOnce(disponibles("2026-10-23T08:00:00Z"));
    const r2 = await consultarDisponibilidad({}, ahora);
    expect(r2.huecos).toHaveLength(1);
  });

  it("un timeout se clasifica como temporal", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(calendlyFetch("/users/me")).rejects.toMatchObject({ tipo: "temporal" });
  });

  it("un 403 de plan sin Scheduling API se clasifica como auth", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ title: "Permission Denied" }, { status: 403 }));
    const e = await calendlyFetch("/invitees", { method: "POST", body: {} }).catch((x) => x);
    expect(e).toBeInstanceOf(CalendlyError);
    expect(e).toMatchObject({ tipo: "auth", status: 403 });
  });
});

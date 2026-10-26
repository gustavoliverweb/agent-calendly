import { describe, expect, it } from "vitest";
import { firmar, igualesSeguro, verificarFirma } from "@/lib/security/hmac";
import { crearLimitador } from "@/lib/security/rate-limit";

const secreto = "clave-de-firma-de-prueba";
const cuerpo = JSON.stringify({ event: "invitee.created", payload: { uri: "x" } });
const t = 1_800_000_000;
const ahora = t * 1000;

describe("verificarFirma", () => {
  const base = { cuerpo, secreto, version: "v1" as const, toleranciaSeg: 180, ahora };

  it("acepta una firma correcta", () => {
    expect(verificarFirma({ ...base, cabecera: firmar(cuerpo, secreto, "v1", t) })).toEqual({ ok: true });
  });

  it("rechaza si falta la cabecera o un campo", () => {
    expect(verificarFirma({ ...base, cabecera: null })).toEqual({ ok: false, motivo: "sin_firma" });
    expect(verificarFirma({ ...base, cabecera: `t=${t}` })).toEqual({ ok: false, motivo: "sin_firma" });
    // Firma v0 (ElevenLabs) donde se espera v1 (Calendly).
    expect(verificarFirma({ ...base, cabecera: firmar(cuerpo, secreto, "v0", t) })).toEqual({
      ok: false,
      motivo: "sin_firma",
    });
  });

  it("rechaza un cuerpo alterado o una clave distinta", () => {
    const cabecera = firmar(cuerpo, secreto, "v1", t);
    expect(verificarFirma({ ...base, cabecera, cuerpo: cuerpo.replace("x", "y") })).toEqual({
      ok: false,
      motivo: "invalida",
    });
    expect(verificarFirma({ ...base, cabecera, secreto: "otra" })).toEqual({ ok: false, motivo: "invalida" });
  });

  it("rechaza firmas fuera de la ventana de tiempo (anti-replay)", () => {
    const vieja = firmar(cuerpo, secreto, "v1", t - 181);
    expect(verificarFirma({ ...base, cabecera: vieja })).toEqual({ ok: false, motivo: "caducada" });
    const dentro = firmar(cuerpo, secreto, "v1", t - 179);
    expect(verificarFirma({ ...base, cabecera: dentro })).toEqual({ ok: true });
  });

  it("acepta si alguna de varias firmas es válida (rotación de secreto)", () => {
    const buena = firmar(cuerpo, secreto, "v0", t).split(",")[1];
    const cabecera = `t=${t},v0=${"0".repeat(64)},${buena}`;
    expect(verificarFirma({ ...base, version: "v0", cabecera })).toEqual({ ok: true });
  });

  it("tolera espacios en la cabecera", () => {
    const cabecera = firmar(cuerpo, secreto, "v1", t).replace(",", ", ");
    expect(verificarFirma({ ...base, cabecera })).toEqual({ ok: true });
  });
});

describe("igualesSeguro", () => {
  it("compara contenido y longitud", () => {
    expect(igualesSeguro("abc", "abc")).toBe(true);
    expect(igualesSeguro("abc", "abd")).toBe(false);
    expect(igualesSeguro("abc", "abcd")).toBe(false);
    expect(igualesSeguro("", "")).toBe(true);
  });
});

describe("crearLimitador", () => {
  it("deja pasar hasta max por ventana y reinicia al acabarla", () => {
    const limitar = crearLimitador({ max: 2, ventanaMs: 1000 });
    expect([limitar("a", 0), limitar("a", 10), limitar("a", 20)]).toEqual([true, true, false]);
    expect(limitar("b", 20)).toBe(true);
    expect(limitar("a", 1000)).toBe(true);
  });
});

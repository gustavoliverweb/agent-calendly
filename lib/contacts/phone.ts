import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export type PhoneResult =
  | { ok: true; e164: string; extranjero: boolean }
  | { ok: false };

/**
 * Normaliza un teléfono a E.164. Sin prefijo se asume España:
 * '600 11 22 33', '0034600112233', '+34 600-112-233' → '+34600112233'.
 */
export function normalizePhone(raw: string | null | undefined): PhoneResult {
  if (!raw) return { ok: false };
  let value = raw.trim().replace(/[\s().-]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (!/^\+?\d{6,16}$/.test(value)) return { ok: false };

  const parsed = parsePhoneNumberFromString(value, "ES");
  if (!parsed || !parsed.isValid()) return { ok: false };
  return { ok: true, e164: parsed.number, extranjero: parsed.country !== "ES" };
}

/** '+34600112233' → '+34 600 11 22 33' para mostrar en pantalla. */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

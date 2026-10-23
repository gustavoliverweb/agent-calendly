/** Interpretación de valores de texto que llegan en un CSV. */

const SI = new Set(["si", "sí", "s", "true", "1", "yes", "y", "x", "ok", "verdadero"]);

export function parseConsent(raw: string | null | undefined): boolean {
  return SI.has((raw ?? "").trim().toLowerCase());
}

/**
 * Fecha en formato español (dd/mm/aaaa, dd-mm-aaaa, con hora opcional) o ISO.
 * Devuelve ISO 8601 o null si no se reconoce. Las fechas sin zona se
 * interpretan a mediodía UTC para que no cambien de día por la zona horaria.
 */
export function parseFecha(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const es = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (es) {
    const [, d, m, y, hh, mm] = es;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const date = new Date(Date.UTC(year, Number(m) - 1, Number(d), hh ? Number(hh) : 12, mm ? Number(mm) : 0));
    const valid =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === Number(m) - 1 &&
      date.getUTCDate() === Number(d);
    return valid ? date.toISOString() : null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
      ? null
      : date.toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(raw: string | null | undefined): boolean {
  return EMAIL_RE.test((raw ?? "").trim());
}

/** Texto limpio o null si está vacío. */
export function clean(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  return value ? value : null;
}

/**
 * Logger JSON estructurado para Vercel. Nunca registrar datos personales
 * completos: los teléfonos y emails se enmascaran automáticamente.
 */

/** '+34600112233' → '+34******233' */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length <= 6) return "***";
  const prefix = digits.startsWith("+") ? digits.slice(0, 3) : digits.slice(0, 2);
  return prefix + "*".repeat(digits.length - prefix.length - 3) + digits.slice(-3);
}

/** 'maria@example.com' → 'm***@example.com' */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

// Sin letras ni guiones pegados: así no se confunden UUID con teléfonos.
const PHONE_RE = /(?<![\w-])\+?\d[\d\s-]{7,}\d(?![\w-])/g;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /[^\s@"'<>()[\],;:]+@[^\s@"'<>()[\],;:]+\.[a-z]{2,}/gi;

/** Enmascara teléfonos y emails dentro de un texto libre. */
export function maskText(text: string): string {
  return text.replace(EMAIL_RE, maskEmail).replace(PHONE_RE, (m) => (UUID_RE.test(m) ? m : maskPhone(m)));
}

type Fields = Record<string, unknown>;

/** Claves que nunca se registran, ni enmascaradas. */
const OMIT_KEYS = new Set(["transcripcion", "transcript", "password", "token", "authorization"]);

export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[…]";
  if (typeof value === "string") return maskText(value);
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Fields = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = OMIT_KEYS.has(k.toLowerCase()) ? "[omitido]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: "info" | "warn" | "error", msg: string, fields?: Fields) {
  const entry = { level, msg, time: new Date().toISOString(), ...(sanitize(fields ?? {}) as Fields) };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};

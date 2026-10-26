import Papa from "papaparse";

/** Campos de contacto que se pueden importar. */
export const CAMPOS = [
  "nombre",
  "telefono",
  "email",
  "consentimiento",
  "consentimiento_fecha",
  "consentimiento_origen",
  "notas",
] as const;

export type Campo = (typeof CAMPOS)[number];
export type Mapeo = Partial<Record<Campo, string>>;

export const ETIQUETAS: Record<Campo, string> = {
  nombre: "Nombre",
  telefono: "Teléfono",
  email: "Email",
  consentimiento: "Consentimiento",
  consentimiento_fecha: "Fecha de consentimiento",
  consentimiento_origen: "Origen del consentimiento",
  notas: "Notas",
};

const ALIAS: Record<Campo, string[]> = {
  nombre: ["nombre", "name", "nombre completo", "nombre y apellidos", "cliente", "contacto"],
  telefono: ["telefono", "tel", "movil", "celular", "phone", "numero", "numero de telefono", "telefono movil"],
  email: ["email", "e-mail", "correo", "correo electronico", "mail"],
  consentimiento: ["consentimiento", "consent", "acepta", "opt-in", "optin", "acepta llamadas"],
  consentimiento_fecha: ["fecha consentimiento", "fecha de consentimiento", "consentimiento fecha", "consent date", "fecha"],
  consentimiento_origen: ["origen", "origen consentimiento", "origen del consentimiento", "fuente"],
  notas: ["notas", "nota", "observaciones", "comentarios", "notes"],
};

export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Propone qué columna del CSV corresponde a cada campo. */
export function detectarMapeo(headers: string[]): Mapeo {
  const mapeo: Mapeo = {};
  const usadas = new Set<string>();
  for (const campo of CAMPOS) {
    const header = headers.find(
      (h) => !usadas.has(h) && ALIAS[campo].includes(normalizeHeader(h)),
    );
    if (header) {
      mapeo[campo] = header;
      usadas.add(header);
    }
  }
  return mapeo;
}

/**
 * Decodifica el archivo: UTF-8 si es válido; si no, Windows-1252
 * (lo habitual al exportar desde Excel en España).
 */
export function decodificar(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text.replace(/^﻿/, "");
}

export type CsvParseado = { headers: string[]; filas: Record<string, string>[] };

/** Detecta el delimitador (',' o ';') automáticamente. */
export function parsearCsv(texto: string): CsvParseado {
  const result = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = (result.meta.fields ?? []).filter(Boolean);
  return { headers, filas: result.data };
}

/** Aplica el mapeo: de filas del CSV a filas con los campos de contacto. */
export function aplicarMapeo(
  filas: Record<string, string>[],
  mapeo: Mapeo,
): Partial<Record<Campo, string>>[] {
  return filas.map((fila) => {
    const out: Partial<Record<Campo, string>> = {};
    for (const campo of CAMPOS) {
      const col = mapeo[campo];
      if (col) out[campo] = fila[col] ?? "";
    }
    return out;
  });
}

/**
 * Celdas que Excel ejecutaría como fórmula: empiezan por =, @, tabulador o
 * retorno, o por + / - seguido de algo que no sea un número. Así
 * "+34 600 11 22 33" queda intacto y "+HYPERLINK(…)" se escapa.
 */
const FORMULA = /^(?:[=@\t\r]|[+-](?![\d\s().]*$))/;

/**
 * Genera un CSV (separado por ';', para Excel en español), escapando las
 * fórmulas: los datos vienen de archivos de terceros.
 */
export function generarCsv(filas: Record<string, unknown>[]): string {
  return "﻿" + Papa.unparse(filas, { delimiter: ";", escapeFormulae: FORMULA });
}

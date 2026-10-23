import type { Campo } from "./csv";
import { clean, isValidEmail, parseConsent, parseFecha } from "./parse";
import { normalizePhone } from "./phone";

/** Máximo de filas por archivo de importación. */
export const MAX_FILAS = 5000;

export type EstadoFila =
  | "valido"
  | "telefono_invalido"
  | "falta_nombre"
  | "duplicado_en_archivo"
  | "duplicado_en_bd";

export type AvisoFila = "email_invalido" | "sin_consentimiento" | "telefono_extranjero" | "fecha_invalida";

export const ETIQUETA_ESTADO_FILA: Record<EstadoFila, string> = {
  valido: "Válido",
  telefono_invalido: "Teléfono inválido",
  falta_nombre: "Falta el nombre",
  duplicado_en_archivo: "Duplicado en el archivo",
  duplicado_en_bd: "Ya existe",
};

export const ETIQUETA_AVISO: Record<AvisoFila, string> = {
  email_invalido: "Email no válido (se ignora)",
  sin_consentimiento: "Sin consentimiento",
  telefono_extranjero: "Teléfono no español",
  fecha_invalida: "Fecha de consentimiento no reconocida",
};

export type FilaEntrada = Partial<Record<Campo, string>>;

export type FilaValidada = {
  /** Número de línea en el archivo (la cabecera es la línea 1). */
  linea: number;
  estado: EstadoFila;
  avisos: AvisoFila[];
  original: FilaEntrada;
  contacto: {
    nombre: string | null;
    telefono: string | null;
    email: string | null;
    consentimiento: boolean;
    consentimiento_fecha: string | null;
    consentimiento_origen: string | null;
    notas: string | null;
  };
};

/**
 * Valida y normaliza filas de importación. Se usa igual en el navegador
 * (vista previa) y en el servidor (importación definitiva).
 * `existentes`: teléfonos E.164 que ya están en la base de datos.
 */
export function validarFilas(filas: FilaEntrada[], existentes: ReadonlySet<string>): FilaValidada[] {
  const vistos = new Set<string>();

  return filas.map((original, i) => {
    const avisos: AvisoFila[] = [];
    const phone = normalizePhone(original.telefono);
    const nombre = clean(original.nombre);
    const emailRaw = clean(original.email);
    const email = emailRaw && isValidEmail(emailRaw) ? emailRaw.toLowerCase() : null;
    if (emailRaw && !email) avisos.push("email_invalido");

    const consentimiento = parseConsent(original.consentimiento);
    if (!consentimiento) avisos.push("sin_consentimiento");
    const fechaRaw = clean(original.consentimiento_fecha);
    const fecha = parseFecha(fechaRaw);
    if (fechaRaw && !fecha) avisos.push("fecha_invalida");
    if (phone.ok && phone.extranjero) avisos.push("telefono_extranjero");

    let estado: EstadoFila = "valido";
    if (!phone.ok) estado = "telefono_invalido";
    else if (!nombre) estado = "falta_nombre";
    else if (vistos.has(phone.e164)) estado = "duplicado_en_archivo";
    else if (existentes.has(phone.e164)) estado = "duplicado_en_bd";

    // Solo la primera aparición válida de un teléfono "ocupa" el número.
    if (phone.ok && nombre && !vistos.has(phone.e164)) vistos.add(phone.e164);

    return {
      linea: i + 2,
      estado,
      avisos,
      original,
      contacto: {
        nombre,
        telefono: phone.ok ? phone.e164 : null,
        email,
        consentimiento,
        // Si hay consentimiento sin fecha, el servidor registra el momento de la importación.
        consentimiento_fecha: consentimiento ? fecha : null,
        consentimiento_origen: clean(original.consentimiento_origen),
        notas: clean(original.notas),
      },
    };
  });
}

export type Resumen = Record<EstadoFila, number> & { total: number; sinConsentimiento: number };

export function resumir(filas: FilaValidada[]): Resumen {
  const r: Resumen = {
    total: filas.length,
    valido: 0,
    telefono_invalido: 0,
    falta_nombre: 0,
    duplicado_en_archivo: 0,
    duplicado_en_bd: 0,
    sinConsentimiento: 0,
  };
  for (const f of filas) {
    r[f.estado]++;
    if (f.estado === "valido" && f.avisos.includes("sin_consentimiento")) r.sinConsentimiento++;
  }
  return r;
}

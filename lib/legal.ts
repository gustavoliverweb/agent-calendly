import { MARCA } from "@/lib/marca";

/**
 * Datos del titular de la web que exigen el aviso legal (LSSI-CE, art. 10) y
 * la política de privacidad (RGPD, art. 13). Mientras un campo valga null, las
 * páginas legales muestran un hueco marcado y no se indexan.
 */
export const TITULAR = {
  razonSocial: null as string | null,
  nif: null as string | null,
  domicilio: null as string | null,
  // "Registro Mercantil de …, tomo …, folio …, hoja …". Solo sociedades.
  registro: null as string | null,
  email: MARCA.email === "hola@example.com" ? null : (MARCA.email as string | null),
  telefono: null as string | null,
  // Delegado de protección de datos, si se designa. Opcional.
  dpd: null as string | null,
  // Operador de la línea SIP, encargado del tratamiento de las llamadas.
  operadorTelefonico: null as string | null,
};

export type CampoTitular = keyof typeof TITULAR;

/** Campos opcionales: su ausencia no deja la página como borrador. */
const OPCIONALES: CampoTitular[] = ["dpd", "telefono"];

export const ETIQUETAS: Record<CampoTitular, string> = {
  razonSocial: "Razón social o nombre del titular",
  nif: "NIF / CIF",
  domicilio: "Domicilio social",
  registro: "Datos de inscripción registral",
  email: "Email de contacto",
  telefono: "Teléfono de contacto",
  dpd: "Delegado de protección de datos",
  operadorTelefonico: "Operador de telefonía",
};

/** Fecha de la última revisión de los textos legales (se cambia a mano). */
export const ACTUALIZACION_LEGAL = "27 de octubre de 2026";

/**
 * Pasa a true cuando un asesor haya revisado los textos y se hayan resuelto
 * los puntos marcados con <Revisar>. Hasta entonces se muestran marcados.
 */
export const TEXTOS_REVISADOS = false;

export function huecosPendientes(datos: Record<CampoTitular, string | null> = TITULAR): CampoTitular[] {
  return (Object.keys(datos) as CampoTitular[]).filter((c) => !OPCIONALES.includes(c) && !datos[c]?.trim());
}

/** Borrador mientras falten datos obligatorios o la revisión de los textos. */
export function legalEsBorrador(datos: Record<CampoTitular, string | null> = TITULAR, revisados = TEXTOS_REVISADOS) {
  return !revisados || huecosPendientes(datos).length > 0;
}

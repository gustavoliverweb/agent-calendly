import { ETIQUETAS } from "./csv";
import { ETIQUETA_ESTADO, type ContactoEstado } from "./estados";

/** Columnas que se leen para exportar. */
export const COLUMNAS_EXPORTACION =
  "id, nombre, telefono, email, consentimiento, consentimiento_fecha, consentimiento_origen, notas, organizacion, cargo, sector, web, origen_datos, estado, intentos, ultimo_intento_en, requiere_seguimiento, seguimiento_motivo, no_llamar_en, creado_en";

/** Tope de filas por exportación (la lectura va por páginas de 1000). */
export const MAX_EXPORTACION = 50_000;

export type ContactoExportable = {
  nombre: string;
  telefono: string;
  email: string | null;
  consentimiento: boolean;
  consentimiento_fecha: string | null;
  consentimiento_origen: string | null;
  notas: string | null;
  organizacion: string | null;
  cargo: string | null;
  sector: string | null;
  web: string | null;
  origen_datos: string | null;
  estado: ContactoEstado;
  intentos: number;
  ultimo_intento_en: string | null;
  requiere_seguimiento: boolean;
  seguimiento_motivo: string | null;
  no_llamar_en: string | null;
  creado_en: string;
};

const fecha = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fechaHora = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const soloFecha = (iso: string | null) => (iso ? fecha.format(new Date(iso)) : "");
const conHora = (iso: string | null) => (iso ? fechaHora.format(new Date(iso)).replace(",", "") : "");
const siNo = (v: boolean) => (v ? "sí" : "no");

/**
 * Fila del CSV de exportación. Las primeras columnas usan los mismos
 * encabezados que la importación (se detectan solos al volver a importar);
 * el resto es el estado de las llamadas, solo informativo.
 */
export function filaExportacion(c: ContactoExportable): Record<string, string | number> {
  return {
    [ETIQUETAS.nombre]: c.nombre,
    [ETIQUETAS.telefono]: c.telefono,
    [ETIQUETAS.email]: c.email ?? "",
    [ETIQUETAS.organizacion]: c.organizacion ?? "",
    [ETIQUETAS.cargo]: c.cargo ?? "",
    [ETIQUETAS.sector]: c.sector ?? "",
    [ETIQUETAS.web]: c.web ?? "",
    [ETIQUETAS.origen_datos]: c.origen_datos ?? "",
    [ETIQUETAS.consentimiento]: siNo(c.consentimiento),
    [ETIQUETAS.consentimiento_fecha]: soloFecha(c.consentimiento_fecha),
    [ETIQUETAS.consentimiento_origen]: c.consentimiento_origen ?? "",
    [ETIQUETAS.notas]: c.notas ?? "",
    Estado: ETIQUETA_ESTADO[c.estado] ?? c.estado,
    Intentos: c.intentos,
    "Último intento": conHora(c.ultimo_intento_en),
    "Requiere seguimiento": siNo(c.requiere_seguimiento),
    "Motivo de seguimiento": c.seguimiento_motivo ?? "",
    "No llamar desde": soloFecha(c.no_llamar_en),
    "Alta": conHora(c.creado_en),
  };
}

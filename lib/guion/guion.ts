import { z } from "zod";

/**
 * Guion de cada empresa (plan SaaS §2.1): apartados del formulario, montaje
 * del texto que recibe el agente como {{guion_negocio}} y validación legal
 * del primer mensaje. Sin dependencias de servidor: lo usan el panel, las
 * llamadas y los tests.
 */

/**
 * Voz del guion: un voice_id de ElevenLabs o null (la configurada en el
 * agente). Las que se pueden elegir salen del catálogo de /admin/voces; esa
 * comprobación la hace el servidor al guardar (vozPermitida).
 */
export const VOZ_AGENTE = "Voz por defecto del agente";
export const VOICE_ID = /^[A-Za-z0-9]{1,64}$/;

/** Marcadores que se pueden usar en el primer mensaje. */
export const MARCADORES = {
  nombre: "nombre de la persona a la que se llama",
  negocio: "nombre del negocio",
  agente: "nombre del agente",
  empresa: "empresa del contacto (llamadas B2B)",
  cargo: "cargo del contacto (llamadas B2B)",
} as const;

export const APARTADOS = [
  { campo: "negocio", titulo: "A qué se dedica", max: 1500, obligatorio: true },
  { campo: "motivo", titulo: "Motivo de la llamada", max: 1000, obligatorio: true },
  { campo: "oferta", titulo: "Oferta", max: 1500, obligatorio: true },
  { campo: "cita", titulo: "La cita", max: 800, obligatorio: true },
  { campo: "preguntas", titulo: "Preguntas frecuentes", max: 3000, obligatorio: false },
  { campo: "objeciones", titulo: "Objeciones propias del negocio", max: 2000, obligatorio: false },
  { campo: "limites", titulo: "Lo que no debes decir", max: 1500, obligatorio: false },
] as const;

export type CampoApartado = (typeof APARTADOS)[number]["campo"];

/** Tope del texto montado: lo que ocupa en el prompt de cada llamada. */
export const MAX_TEXTO = 8000;

/** Normaliza para buscar palabras sin depender de tildes ni mayúsculas. */
function plano(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * El primer mensaje debe identificar al agente como IA (AI Act, art. 50) y
 * avisar de que la llamada se transcribe o graba (RGPD). Devuelve qué falta.
 */
export function problemasPrimerMensaje(mensaje: string): string[] {
  const p = plano(mensaje);
  const problemas: string[] = [];
  if (!/asistente virtual|inteligencia artificial|\bia\b/.test(p)) {
    problemas.push('Debe decir que es una asistente virtual o una inteligencia artificial (p. ej. "una asistente virtual con inteligencia artificial").');
  }
  if (!/transcrib|transcripcion|graba/.test(p)) {
    problemas.push('Debe avisar de que la llamada se transcribe o se graba (p. ej. "esta llamada se transcribe").');
  }
  const desconocidos = [...mensaje.matchAll(/\{([^{}]*)\}/g)]
    .map((m) => m[1].trim())
    .filter((m) => !(m in MARCADORES));
  if (desconocidos.length) {
    problemas.push(`Marcadores no válidos: ${desconocidos.map((m) => `{${m}}`).join(", ")}. Usa ${Object.keys(MARCADORES).map((m) => `{${m}}`).join(", ")}.`);
  }
  return problemas;
}

/** Quita llaves dobles: el agente no debe ver {{variables}} escritas por el cliente. */
function limpiar(texto: string) {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/\{\{+/g, "{")
    .replace(/\}\}+/g, "}")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const textoApartado = (max: number, obligatorio: boolean, titulo: string): z.ZodType<string, string> => {
  const base = z.string().transform(limpiar).pipe(z.string().max(max, `${titulo}: máximo ${max} caracteres.`));
  return obligatorio ? base.pipe(z.string().min(1, `${titulo}: es obligatorio.`)) : base;
};

export const guionFormSchema = z
  .object({
    negocio_nombre: z
      .string()
      .transform(limpiar)
      .pipe(z.string().min(1, "Nombre del negocio: es obligatorio.").max(80, "Nombre del negocio: máximo 80 caracteres.")),
    nombre_agente: z
      .string()
      .transform(limpiar)
      .pipe(z.string().min(1, "Nombre del agente: es obligatorio.").max(40, "Nombre del agente: máximo 40 caracteres.")),
    primer_mensaje: z
      .string()
      .transform(limpiar)
      .pipe(
        z
          .string()
          .min(20, "Primer mensaje: mínimo 20 caracteres.")
          .max(400, "Primer mensaje: máximo 400 caracteres."),
      )
      .superRefine((mensaje, ctx) => {
        for (const p of problemasPrimerMensaje(mensaje)) ctx.addIssue({ code: "custom", message: `Primer mensaje: ${p}` });
      }),
    voz_id: z
      .string()
      .nullable()
      .refine((v) => v == null || VOICE_ID.test(v), "Voz no disponible."),
    ...(Object.fromEntries(
      APARTADOS.map((a) => [a.campo, textoApartado(a.max, a.obligatorio, a.titulo)]),
    ) as Record<CampoApartado, z.ZodType<string, string>>),
  })
  .superRefine((g, ctx) => {
    const largo = montarGuion(g).length;
    if (largo > MAX_TEXTO) {
      ctx.addIssue({
        code: "custom",
        message: `El guion ocupa ${largo} caracteres; el máximo es ${MAX_TEXTO}. Resume algún apartado.`,
      });
    }
  });

export type GuionForm = z.input<typeof guionFormSchema>;
export type GuionValido = z.output<typeof guionFormSchema>;

type Montable = { negocio_nombre: string } & Record<CampoApartado, string>;

/** Texto que recibe el agente como {{guion_negocio}}. Omite los apartados vacíos. */
export function montarGuion(g: Montable): string {
  const partes = [`Negocio: ${limpiar(g.negocio_nombre)}`];
  for (const a of APARTADOS) {
    const valor = limpiar(g[a.campo] ?? "");
    if (valor) partes.push(`${a.titulo}:\n${valor}`);
  }
  return partes.join("\n\n");
}

/**
 * Primer mensaje con los marcadores sustituidos, para una llamada concreta.
 * {empresa} y {cargo} quedan vacíos si el contacto no los tiene.
 */
export function renderPrimerMensaje(
  plantilla: string,
  valores: { nombre: string; negocio: string; agente: string; empresa?: string | null; cargo?: string | null },
): string {
  return plantilla
    .replace(/\{\s*(nombre|negocio|agente|empresa|cargo)\s*\}/g, (_, k: keyof typeof valores) => (valores[k] ?? "").trim())
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type GuionLlamada = {
  negocio_nombre: string;
  nombre_agente: string;
  primer_mensaje: string;
  texto: string;
  voz_id: string | null;
};

/**
 * Variables dinámicas del guion para una llamada. El prompt fijo de
 * ElevenLabs usa {{negocio}}, {{nombre_agente}}, {{guion_negocio}} y el
 * primer mensaje es {{primer_mensaje}}.
 */
export function variablesGuion(
  guion: GuionLlamada,
  contacto: string | { nombre: string; organizacion?: string | null; cargo?: string | null },
) {
  const c = typeof contacto === "string" ? { nombre: contacto } : contacto;
  return {
    negocio: guion.negocio_nombre,
    nombre_agente: guion.nombre_agente,
    guion_negocio: guion.texto,
    primer_mensaje: renderPrimerMensaje(guion.primer_mensaje, {
      nombre: c.nombre,
      negocio: guion.negocio_nombre,
      agente: guion.nombre_agente,
      empresa: "organizacion" in c ? c.organizacion : null,
      cargo: "cargo" in c ? c.cargo : null,
    }),
  };
}

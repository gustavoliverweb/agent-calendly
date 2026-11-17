/**
 * Clases compartidas por la página de inicio y las páginas de contenido de la web.
 *
 * Escala tipográfica 1,25 (16 · 20 · 25 · 31 · 39 · 49 · 61 · 76 px) con
 * Bricolage Grotesque: los titulares van estrechos (eje de anchura al 86 %)
 * y en seminegrita; el texto, a 17 px con líneas de menos de 70 caracteres.
 */
export const titular = "font-semibold tracking-[-0.018em] text-balance [font-stretch:86%]";
/** Titular de página (h1) y de sección (h2). */
export const titularPagina = `${titular} text-[clamp(2.75rem,7vw,4.75rem)] leading-[0.95]`;
export const titularSeccion = `${titular} text-[clamp(2.1rem,4.4vw,3.05rem)] leading-[1]`;
/** Entradilla: la frase que acompaña a un titular. */
export const entradilla = "text-[clamp(1.25rem,2vw,1.55rem)] leading-snug text-ceniza text-pretty";
/** Texto corrido. */
export const cuerpo = "text-[17px] leading-relaxed text-ceniza";
/** Antetítulo de página: a quién va dirigida o en qué sección está. */
export const rotulo = "text-[15px] font-medium text-marca-700";

export const botonPrincipal =
  "inline-flex h-12 items-center gap-2 rounded-full bg-marca-600 px-6 text-[16px] font-medium text-white transition-colors hover:bg-marca-700";
export const botonBorde =
  "inline-flex h-12 items-center gap-2 rounded-full border border-carbon/20 bg-white px-6 text-[16px] font-medium text-carbon transition-colors hover:border-carbon";
/** Sobre las secciones granate: el rojo apenas contrasta, así que la acción principal va en blanco. */
export const botonClaro =
  "inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[16px] font-medium text-tinta-950 transition-colors hover:bg-marca-50";
export const botonBordeOscuro =
  "inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-6 text-[16px] font-medium text-white transition-colors hover:border-white";

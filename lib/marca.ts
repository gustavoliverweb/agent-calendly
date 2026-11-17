/**
 * Identidad de la marca en un solo sitio: nombre, eslogan y contacto que usan
 * la landing y el panel. "Cadencia" es un nombre provisional.
 */
export const MARCA = {
  nombre: "Cadencia",
  descripcion: "Agente de voz con IA que llama a tus leads, conversa con ellos y les agenda la cita en tu calendario.",
  // Contacto que aparece en la web (también en /contacto como alternativa al formulario).
  email: "hola@example.com",
} as const;

/** Destino de «Solicitar una demo»: el formulario de contacto. */
export const enlaceDemo = "/contacto";

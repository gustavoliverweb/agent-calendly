/**
 * Identidad de la marca en un solo sitio: nombre, eslogan y contacto que usan
 * la landing y el panel. "Cadencia" es un nombre provisional.
 */
export const MARCA = {
  nombre: "Cadencia",
  descripcion: "Agente de voz con IA que llama a tus leads, conversa con ellos y les agenda la cita en tu calendario.",
  // Destino de "Solicitar una demo" hasta que haya formulario propio.
  email: "hola@example.com",
} as const;

export const enlaceDemo = `mailto:${MARCA.email}?subject=${encodeURIComponent(`Demo de ${MARCA.nombre}`)}`;

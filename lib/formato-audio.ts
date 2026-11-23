/**
 * Formato real de un audio por sus primeros bytes. No se fía de la cabecera
 * Content-Type: las muestras de ElevenLabs alojadas en storage.googleapis.com
 * llegan como text/plain aunque son MP3.
 */
export function formatoAudio(bytes: Uint8Array): string | null {
  const b = (i: number) => bytes[i];
  const ascii = (desde: number, hasta: number) => String.fromCharCode(...bytes.slice(desde, hasta));
  if (bytes.length < 4) return null;
  // MP3 con etiqueta ID3 o empezando directamente por una trama MPEG.
  if (ascii(0, 3) === "ID3" || (b(0) === 0xff && (b(1) & 0xe0) === 0xe0)) return "audio/mpeg";
  if (ascii(0, 4) === "OggS") return "audio/ogg";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  return null;
}

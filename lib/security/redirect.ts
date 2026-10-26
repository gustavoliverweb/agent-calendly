const BASE = "http://interno.invalid";

/**
 * Destino de redirección seguro: solo rutas del propio panel. Se resuelve con
 * el mismo analizador de URLs que el navegador, porque comprobar el texto no
 * basta: "/\evil.com" o "/<tab>/evil.com" empiezan por una sola barra y aun
 * así el navegador los lleva a evil.com.
 */
export function rutaInterna(destino: string | null | undefined): string {
  if (!destino || !destino.startsWith("/")) return "/";
  try {
    const url = new URL(destino, BASE);
    if (url.origin !== BASE) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

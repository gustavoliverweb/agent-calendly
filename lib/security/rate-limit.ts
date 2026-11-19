/**
 * Límite de peticiones con ventana fija, en memoria de cada instancia. No es
 * un límite global exacto (cada instancia serverless lleva su cuenta), pero
 * corta el abuso si un secreto se filtra y el ruido de intentos sin token.
 */
/** Claves que recuerda cada limitador como máximo. */
const MAX_CLAVES = 5000;

export function crearLimitador({ max, ventanaMs }: { max: number; ventanaMs: number }) {
  const cubos = new Map<string, { inicio: number; n: number }>();
  return (clave: string, ahora = Date.now()): boolean => {
    const c = cubos.get(clave);
    if (!c || ahora - c.inicio >= ventanaMs) {
      if (c) cubos.delete(clave);
      // Evita crecer sin límite con muchas claves distintas sin vaciarlo todo:
      // vaciarlo dejaría a cualquiera reiniciar los contadores de los demás.
      if (cubos.size >= MAX_CLAVES) {
        for (const [k, v] of cubos) if (ahora - v.inicio >= ventanaMs) cubos.delete(k);
        // Si siguen siendo demasiadas, se van las más antiguas (orden de inserción),
        // primero las que no han superado el límite: así inundar con claves
        // nuevas no desbloquea a quien ya está bloqueado.
        for (const soloSinBloquear of [true, false]) {
          for (const [k, v] of cubos) {
            if (cubos.size < MAX_CLAVES) break;
            if (!soloSinBloquear || v.n <= max) cubos.delete(k);
          }
        }
      }
      cubos.set(clave, { inicio: ahora, n: 1 });
      return true;
    }
    c.n++;
    return c.n <= max;
  };
}

/** IP del cliente tras el proxy de Render (primer salto de x-forwarded-for). */
export function ipCliente(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocida";
}

/** Intentos con token incorrecto por IP: 20 por minuto. */
export const limitarFallosAuth = crearLimitador({ max: 20, ventanaMs: 60_000 });

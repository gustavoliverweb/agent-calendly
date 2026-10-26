/**
 * Límite de peticiones con ventana fija, en memoria de cada instancia. No es
 * un límite global exacto (cada instancia serverless lleva su cuenta), pero
 * corta el abuso si un secreto se filtra y el ruido de intentos sin token.
 */
export function crearLimitador({ max, ventanaMs }: { max: number; ventanaMs: number }) {
  const cubos = new Map<string, { inicio: number; n: number }>();
  return (clave: string, ahora = Date.now()): boolean => {
    const c = cubos.get(clave);
    if (!c || ahora - c.inicio >= ventanaMs) {
      // Evita crecer sin límite con muchas IPs distintas.
      if (cubos.size > 5000) cubos.clear();
      cubos.set(clave, { inicio: ahora, n: 1 });
      return true;
    }
    c.n++;
    return c.n <= max;
  };
}

/** IP del cliente tras el proxy de Vercel (primer salto de x-forwarded-for). */
export function ipCliente(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocida";
}

/** Intentos con token incorrecto por IP: 20 por minuto. */
export const limitarFallosAuth = crearLimitador({ max: 20, ventanaMs: 60_000 });

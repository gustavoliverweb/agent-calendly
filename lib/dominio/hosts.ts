/**
 * Marca blanca (plan SaaS §4.3): qué dominio es de la plataforma y cuál de
 * una empresa. Sin dependencias de servidor: lo usa también proxy.ts.
 *
 * - Plataforma: el host de APP_URL, los de PLATFORM_HOSTS (lista separada por
 *   comas), localhost y, si hay dominio base, ese dominio y www.<dominio base>.
 *   Muestra la landing y /admin.
 * - Empresa: cualquier otro host. <slug>.<BASE_DOMAIN> es la dirección por
 *   defecto de cada empresa; el resto son dominios propios (dominios_empresa).
 */

/** "Llamadas.Empresa.com:443." → "llamadas.empresa.com" */
export function normalizarHost(host: string | null | undefined): string {
  if (!host) return "";
  const primero = host.split(",")[0].trim().toLowerCase();
  // IPv6 entre corchetes: se deja tal cual (solo en desarrollo).
  if (primero.startsWith("[")) return primero;
  return primero.replace(/\.$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
}

function hostDeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return normalizarHost(new URL(url.replace(/\s+#.*$/, "").trim()).host);
  } catch {
    return null;
  }
}

/** Dominio base de la plataforma (BASE_DOMAIN), si lo hay. */
export function dominioBase(env: Record<string, string | undefined> = process.env): string | null {
  const base = normalizarHost(env.BASE_DOMAIN?.replace(/\s+#.*$/, ""));
  return base || null;
}

export function hostsPlataforma(env: Record<string, string | undefined> = process.env): Set<string> {
  const hosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const app = hostDeUrl(env.APP_URL);
  if (app) hosts.add(app);
  for (const h of (env.PLATFORM_HOSTS ?? "").replace(/\s+#.*$/, "").split(",")) {
    const n = normalizarHost(h);
    if (n) hosts.add(n);
  }
  const base = dominioBase(env);
  if (base) {
    hosts.add(base);
    hosts.add(`www.${base}`);
  }
  return hosts;
}

export function esHostPlataforma(host: string, env: Record<string, string | undefined> = process.env): boolean {
  // Sin host (peticiones internas) se trata como la plataforma: el comportamiento de siempre.
  return !host || hostsPlataforma(env).has(host);
}

/** "empresa-a.base.com" → "empresa-a" si BASE_DOMAIN es "base.com" (un solo nivel). */
export function slugDeSubdominio(host: string, env: Record<string, string | undefined> = process.env): string | null {
  const base = dominioBase(env);
  if (!base || !host.endsWith(`.${base}`)) return null;
  const slug = host.slice(0, -(base.length + 1));
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) && slug !== "www" ? slug : null;
}

const DOMINIO_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Valida un dominio propio que da de alta el proveedor (mismo criterio que la BD). */
export function validarDominioPropio(
  valor: string,
  env: Record<string, string | undefined> = process.env,
): { dominio: string } | { error: string } {
  const dominio = normalizarHost(valor.replace(/^https?:\/\//i, "").split("/")[0]);
  if (!dominio || dominio.length > 253 || !DOMINIO_RE.test(dominio)) {
    return { error: "Escribe un dominio válido, p. ej. llamadas.empresa.com (sin https:// ni rutas)." };
  }
  if (esHostPlataforma(dominio, env)) return { error: "Ese dominio es de la plataforma." };
  if (slugDeSubdominio(dominio, env) || dominio.endsWith(`.${dominioBase(env)}`)) {
    return { error: "Los subdominios de la plataforma ya funcionan solos con el identificador de la empresa." };
  }
  return { dominio };
}

/** Un dominio sin subdominio (empresa.com) necesita registros A en vez de CNAME. */
export function esApex(dominio: string): boolean {
  return dominio.split(".").length <= 2;
}

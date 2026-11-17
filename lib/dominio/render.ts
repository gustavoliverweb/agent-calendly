import "server-only";
import { resolveCname, resolve4 } from "node:dns/promises";
import { renderEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { normalizarHost } from "./hosts";

/**
 * Dominios propios de las empresas en el servicio de Render (marca blanca).
 * Render emite el certificado HTTPS cuando el DNS apunta al servicio y lo
 * verifica solo; /verify fuerza una comprobación tras cambiar el DNS.
 * Referencia: api-docs.render.com (custom domains).
 */

export type DominioRender = { id: string; nombre: string; verificado: boolean };

export class RenderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type CustomDomain = { id: string; name: string; verificationStatus: "verified" | "unverified" };

async function peticion(ruta: string, init: RequestInit = {}): Promise<Response> {
  const env = renderEnv();
  const res = await fetch(`${env.RENDER_API_BASE}/services/${env.RENDER_SERVICE_ID}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.RENDER_API_KEY}`, Accept: "application/json", "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok && res.status !== 404) {
    const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
    log.warn("render: error", { ruta, status: res.status, message: cuerpo?.message });
    throw new RenderError(cuerpo?.message ?? `Render respondió ${res.status}`, res.status);
  }
  return res;
}

const aDominio = (d: CustomDomain): DominioRender => ({ id: d.id, nombre: d.name, verificado: d.verificationStatus === "verified" });

export async function consultarDominioRender(nombre: string): Promise<DominioRender | null> {
  const res = await peticion(`/custom-domains/${encodeURIComponent(nombre)}`);
  if (res.status === 404) return null;
  return aDominio((await res.json()) as CustomDomain);
}

/** Añade el dominio al servicio; si ya estaba, devuelve el existente. */
export async function anadirDominioRender(nombre: string): Promise<DominioRender> {
  try {
    const res = await peticion("/custom-domains", { method: "POST", body: JSON.stringify({ name: nombre }) });
    // La referencia documenta un array aunque se cree uno solo.
    const cuerpo = (await res.json()) as CustomDomain | CustomDomain[];
    const creado = (Array.isArray(cuerpo) ? cuerpo : [cuerpo]).find((d) => d.name === nombre);
    if (creado) return aDominio(creado);
  } catch (e) {
    if (!(e instanceof RenderError && e.status === 409)) throw e;
  }
  const existente = await consultarDominioRender(nombre);
  if (!existente) throw new RenderError("Render no devolvió el dominio", 502);
  return existente;
}

export async function verificarDominioRender(nombre: string): Promise<void> {
  await peticion(`/custom-domains/${encodeURIComponent(nombre)}/verify`, { method: "POST" });
}

export async function borrarDominioRender(nombre: string): Promise<void> {
  await peticion(`/custom-domains/${encodeURIComponent(nombre)}`, { method: "DELETE" });
}

/**
 * Destino del CNAME: el subdominio onrender.com del servicio (RENDER_SERVICE_HOST
 * o, si APP_URL es de onrender.com, su host).
 */
export function destinoCname(): string | null {
  const explicito = normalizarHost(process.env.RENDER_SERVICE_HOST?.replace(/\s+#.*$/, ""));
  if (explicito) return explicito;
  try {
    const host = normalizarHost(new URL(process.env.APP_URL ?? "").host);
    return host.endsWith(".onrender.com") ? host : null;
  } catch {
    return null;
  }
}

/**
 * Comprueba el DNS sin la API de Render: CNAME hacia el servicio o, para un
 * dominio raíz, que resuelva a las mismas IP que el servicio.
 */
export async function comprobarDns(dominio: string): Promise<{ ok: boolean; detalle: string }> {
  const destino = destinoCname();
  if (!destino) return { ok: false, detalle: "Falta RENDER_SERVICE_HOST para saber a dónde debe apuntar el CNAME." };
  try {
    const cnames = (await resolveCname(dominio).catch(() => [] as string[])).map((c) => normalizarHost(c));
    if (cnames.includes(destino)) return { ok: true, detalle: `CNAME → ${destino}` };
    const [ipsDominio, ipsServicio] = await Promise.all([resolve4(dominio).catch(() => [] as string[]), resolve4(destino).catch(() => [] as string[])]);
    if (ipsDominio.length && ipsDominio.every((ip) => ipsServicio.includes(ip))) {
      return { ok: true, detalle: `Resuelve a las IP del servicio (${ipsDominio.join(", ")})` };
    }
    return {
      ok: false,
      detalle: cnames.length
        ? `El CNAME apunta a ${cnames.join(", ")} y debe apuntar a ${destino}.`
        : `Aún no hay un CNAME hacia ${destino}.`,
    };
  } catch (e) {
    return { ok: false, detalle: `No se pudo consultar el DNS: ${String(e)}` };
  }
}

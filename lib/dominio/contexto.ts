import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { log } from "@/lib/log";
import { marcaPlataforma } from "@/lib/marca-plataforma";
import { urlImagenMarca } from "./imagen";
import { createAdminClient } from "@/lib/supabase/admin";
import { dominioBase, esHostPlataforma, normalizarHost, slugDeSubdominio } from "./hosts";

/**
 * Empresa y marca que corresponden al dominio de la petición (marca blanca,
 * plan SaaS §4.3). Se resuelve siempre en el servidor a partir del host.
 */

export type Marca = {
  nombre: string;
  /** #rrggbb o null (colores por defecto). */
  color: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  /** Es la marca de la plataforma (su logo lleva el símbolo de la web). */
  plataforma?: true;
};

export type DatosLegalesEmpresa = {
  razonSocial: string | null;
  nif: string | null;
  domicilio: string | null;
  registro: string | null;
  email: string | null;
};

export type EmpresaDominio = {
  id: string;
  nombre: string;
  slug: string;
  estado: string;
  marca: Marca;
  legal: DatosLegalesEmpresa;
};

export type ContextoDominio =
  | { tipo: "plataforma"; host: string }
  | { tipo: "empresa"; host: string; empresa: EmpresaDominio }
  /** Host que no es de la plataforma ni está dado de alta: 404. */
  | { tipo: "desconocido"; host: string };

export { urlImagenMarca };

/** La marca de la plataforma con la forma de la de una empresa (acceso, logo). */
export async function marcaDePlataforma(): Promise<Marca> {
  const m = await marcaPlataforma();
  return { nombre: m.nombre, color: null, logoUrl: m.logoUrl, faviconUrl: m.faviconUrl, plataforma: true };
}

export const COLUMNAS_MARCA =
  "id, nombre, slug, estado, marca_nombre, marca_color, marca_logo, marca_favicon, legal_razon_social, legal_nif, legal_domicilio, legal_registro, legal_email" as const;

type FilaMarca = {
  id: string;
  nombre: string;
  slug: string;
  estado: string;
  marca_nombre: string | null;
  marca_color: string | null;
  marca_logo: string | null;
  marca_favicon: string | null;
  legal_razon_social: string | null;
  legal_nif: string | null;
  legal_domicilio: string | null;
  legal_registro: string | null;
  legal_email: string | null;
};

/** URL pública de una imagen del bucket "marca". */
export function empresaDeFila(f: FilaMarca): EmpresaDominio {
  return {
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    estado: f.estado,
    marca: {
      nombre: f.marca_nombre ?? f.nombre,
      color: f.marca_color,
      logoUrl: urlImagenMarca(f.marca_logo),
      faviconUrl: urlImagenMarca(f.marca_favicon),
    },
    legal: {
      razonSocial: f.legal_razon_social,
      nif: f.legal_nif,
      domicilio: f.legal_domicilio,
      registro: f.legal_registro,
      email: f.legal_email,
    },
  };
}

// --- Host → empresa, con una caché corta en memoria -------------------------

const TTL_MS = 60_000;
const cacheHosts = new Map<string, { empresaId: string | null; hasta: number }>();

/** Tras dar de alta o quitar un dominio (o cambiar un slug). */
export function olvidarDominios() {
  cacheHosts.clear();
}

async function empresaIdDeHost(host: string): Promise<string | null> {
  const guardado = cacheHosts.get(host);
  if (guardado && guardado.hasta > Date.now()) return guardado.empresaId;

  const supabase = createAdminClient();
  const slug = slugDeSubdominio(host);
  const { data, error } = slug
    ? await supabase.from("empresas").select("id").eq("slug", slug).maybeSingle()
    : await supabase.from("dominios_empresa").select("id:empresa_id").eq("dominio", host).maybeSingle();
  if (error) {
    // Sin caché: que la siguiente petición lo vuelva a intentar.
    log.error("resolver dominio", { host, code: error.code });
    throw new Error("No se ha podido resolver el dominio");
  }
  const empresaId = data?.id ?? null;
  cacheHosts.set(host, { empresaId, hasta: Date.now() + TTL_MS });
  return empresaId;
}

// --- Petición actual ---------------------------------------------------------

/** Host público de la petición (detrás del proxy de Render, X-Forwarded-Host). */
export const hostActual = cache(async (): Promise<string> => {
  const h = await headers();
  return normalizarHost(h.get("x-forwarded-host") ?? h.get("host"));
});

/** "https://llamadas.empresa.com" de la petición actual. */
export async function origenActual(): Promise<string> {
  const h = await headers();
  const host = await hostActual();
  const local = host === "localhost" || host === "127.0.0.1";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
  // En local se conserva el puerto (localhost:3000).
  const bruto = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().toLowerCase();
  return `${proto}://${local ? bruto : host}`;
}

export const contextoDominio = cache(async (): Promise<ContextoDominio> => {
  const host = await hostActual();
  if (esHostPlataforma(host)) return { tipo: "plataforma", host };
  const empresaId = await empresaIdDeHost(host);
  if (!empresaId) return { tipo: "desconocido", host };
  const { data } = await createAdminClient().from("empresas").select(COLUMNAS_MARCA).eq("id", empresaId).maybeSingle();
  if (!data) return { tipo: "desconocido", host };
  return { tipo: "empresa", host, empresa: empresaDeFila(data) };
});

/** Marca del dominio actual: la de su empresa o la de la plataforma. */
export async function marcaDelDominio(): Promise<Marca> {
  const ctx = await contextoDominio();
  return ctx.tipo === "empresa" ? ctx.empresa.marca : marcaDePlataforma();
}

/**
 * Dirección con la que entran los usuarios de una empresa (enlaces de acceso,
 * vuelta de Calendly): su primer dominio propio verificado, si no
 * <slug>.<BASE_DOMAIN> y, sin dominio base, APP_URL.
 */
export async function origenEmpresa(empresaId: string): Promise<string> {
  const supabase = createAdminClient();
  const [{ data: dominio }, { data: empresa }] = await Promise.all([
    supabase
      .from("dominios_empresa")
      .select("dominio")
      .eq("empresa_id", empresaId)
      .eq("estado", "verificado")
      .order("creado_en")
      .limit(1)
      .maybeSingle(),
    supabase.from("empresas").select("slug").eq("id", empresaId).maybeSingle(),
  ]);
  if (dominio) return `https://${dominio.dominio}`;
  const base = dominioBase();
  if (base && empresa) return `https://${empresa.slug}.${base}`;
  return new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
}

/** Si un origen ("https://host") es una dirección válida de esa empresa. */
export async function origenEsDeEmpresa(origen: string, empresaId: string): Promise<boolean> {
  let host: string;
  try {
    host = normalizarHost(new URL(origen).host);
  } catch {
    return false;
  }
  if (esHostPlataforma(host)) return true;
  return (await empresaIdDeHost(host).catch(() => null)) === empresaId;
}

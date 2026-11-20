import type { MetadataRoute } from "next";
import { RECURSOS } from "@/lib/contenido/recursos";
import { SOLUCIONES } from "@/lib/contenido/soluciones";
import { legalEsBorrador } from "@/lib/legal";
import { titularVigente } from "@/lib/legal-vigente";

/** Páginas públicas de la web. Las legales, solo cuando dejen de ser borrador. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\s+#.*$/, "").trim().replace(/\/$/, "");
  const rutas = [
    "/",
    "/producto",
    "/precios",
    "/seguridad",
    "/integraciones",
    "/calculadora",
    "/contacto",
    "/recursos",
    ...SOLUCIONES.map((s) => `/soluciones/${s.slug}`),
    ...RECURSOS.map((r) => `/recursos/${r.slug}`),
  ];
  if (!legalEsBorrador(await titularVigente())) rutas.push("/aviso-legal", "/privacidad", "/cookies");
  return rutas.map((ruta) => ({ url: `${base}${ruta}`, changeFrequency: "monthly", priority: ruta === "/" ? 1 : 0.7 }));
}

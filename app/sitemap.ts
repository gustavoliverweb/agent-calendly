import type { MetadataRoute } from "next";
import { SOLUCIONES } from "@/lib/contenido/soluciones";
import { legalEsBorrador } from "@/lib/legal";

/** Páginas públicas de la web. Las legales, solo cuando dejen de ser borrador. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\s+#.*$/, "").trim().replace(/\/$/, "");
  const rutas = ["/", "/precios", "/seguridad", "/contacto", ...SOLUCIONES.map((s) => `/soluciones/${s.slug}`)];
  if (!legalEsBorrador()) rutas.push("/aviso-legal", "/privacidad", "/cookies");
  return rutas.map((ruta) => ({ url: `${base}${ruta}`, changeFrequency: "monthly", priority: ruta === "/" ? 1 : 0.7 }));
}

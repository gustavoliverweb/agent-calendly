import type { MetadataRoute } from "next";

/** La web pública es indexable; el panel, la administración y la API, no. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "").replace(/\s+#.*$/, "").trim().replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/cuenta", "/login", "/auth", "/api", "/legal-empresa"],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}

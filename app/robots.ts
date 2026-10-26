import type { MetadataRoute } from "next";

/** Solo la landing es pública para los buscadores. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/cuenta", "/login", "/auth", "/api"] },
  };
}

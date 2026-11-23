import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { RECURSOS } from "@/lib/contenido/recursos";
import { SOLUCIONES } from "@/lib/contenido/soluciones";
import { esHostLocal, esHostPlataforma, normalizarHost } from "@/lib/dominio/hosts";
import type { Database } from "./database.types";

/**
 * Rutas que exigen sesión: el panel, la cuenta y la administración. Todo lo demás (landing,
 * login, enlaces de los correos) es público; los datos siguen protegidos por
 * RLS aunque una página se publicara por error.
 */
const PRIVATE_PATHS = ["/app", "/cuenta", "/admin"];

function isPrivate(pathname: string) {
  return PRIVATE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refresca la sesión de Supabase en cada petición y redirige a /login
 * las rutas del panel cuando no hay usuario.
 */
/** Páginas de la web de la plataforma: no existen en el dominio de una empresa. */
const WEB_PLATAFORMA = [
  "/producto",
  "/precios",
  "/seguridad",
  "/integraciones",
  "/calculadora",
  "/contacto",
  "/soluciones",
  "/recursos",
];

/** Páginas con slug: solo existen los de su contenido. */
const CON_SLUG = [
  { prefijo: "/soluciones/", slugs: SOLUCIONES.map((s) => s.slug) },
  { prefijo: "/recursos/", slugs: RECURSOS.map((r) => r.slug) },
];

/** Páginas legales que en el dominio de una empresa muestran los datos de esa empresa. */
const LEGALES = ["/aviso-legal", "/privacidad", "/cookies"];

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = normalizarHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  const dominioEmpresa = !esHostPlataforma(host);

  // Dominio de una empresa (marca blanca): sin landing ni páginas de la plataforma, directo al panel/login.
  const redirigir = (ruta: string) => redireccion(request, ruta);
  if (dominioEmpresa && pathname === "/") return redirigir("/app");
  if (dominioEmpresa && WEB_PLATAFORMA.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return new NextResponse("Not Found", { status: 404 });
  }
  // Soluciones y recursos: solo los que existen (con Cache Components, notFound() llega tarde y respondería 200).
  const conSlug = CON_SLUG.find((c) => pathname.startsWith(c.prefijo));
  if (!dominioEmpresa && conSlug && !conSlug.slugs.includes(pathname.slice(conSlug.prefijo.length))) {
    return new NextResponse("Not Found", { status: 404 });
  }
  // Las páginas legales de empresa solo existen reescritas desde su dominio.
  if (!dominioEmpresa && (pathname === "/legal-empresa" || pathname.startsWith("/legal-empresa/"))) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const reescritura = dominioEmpresa && LEGALES.includes(pathname) ? `/legal-empresa${pathname}` : null;
  const siguiente = () => {
    if (!reescritura) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = reescritura;
    return NextResponse.rewrite(url, { request });
  };

  let response = siguiente();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = siguiente();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // No meter código entre createServerClient y getClaims: puede provocar
  // cierres de sesión aleatorios difíciles de depurar.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user && isPrivate(pathname)) {
    return copyCookies(response, redirigir(pathname === "/app" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`));
  }

  if (user && pathname === "/login") return copyCookies(response, redirigir("/app"));

  return response;
}

/**
 * Redirección al dominio público por el que entró el navegador (el de la
 * empresa, con marca blanca): la URL de la petición lleva el host interno
 * (detrás del proxy de Render, o localhost) y el proxy exige una URL absoluta.
 */
function redireccion(request: NextRequest, ruta: string) {
  const bruto = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const host = normalizarHost(bruto);
  const local = esHostLocal(host);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
  const origen = host ? `${proto}://${local ? bruto : host}` : request.nextUrl.origin;
  return NextResponse.redirect(new URL(ruta, origen), 307);
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => to.cookies.set(c));
  return to;
}

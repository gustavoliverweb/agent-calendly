/** URL pública de una imagen del bucket "marca" de Supabase Storage. */
export function urlImagenMarca(ruta: string | null): string | null {
  if (!ruta) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/marca/${ruta.split("/").map(encodeURIComponent).join("/")}` : null;
}

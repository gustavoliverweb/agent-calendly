/**
 * TEMPORAL: muestra cómo llegan las cabeceras de red detrás del proxy de
 * Render, para leer bien la IP del cliente. Solo devuelve las cabeceras de
 * quien la llama. Borrar en cuanto se haya consultado.
 */
const CABECERAS = [
  "x-forwarded-for",
  "x-real-ip",
  "true-client-ip",
  "cf-connecting-ip",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "host",
];

export function GET(req: Request) {
  return Response.json(Object.fromEntries(CABECERAS.map((c) => [c, req.headers.get(c)])), {
    headers: { "Cache-Control": "no-store" },
  });
}

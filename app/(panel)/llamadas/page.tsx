import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/panel/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Paginacion } from "@/components/contactos/paginacion";
import { EstadoLlamada } from "@/components/llamadas/estado-llamada";
import { AutoRefresco } from "@/components/llamadas/auto-refresco";
import { ESTADOS_LLAMADA, ETIQUETA_LLAMADA, etiquetaClasificacion, formatearDuracion, MOTIVO_FALLO } from "@/lib/calls/estados";
import { leerFiltrosLlamadas, listarLlamadas, POR_PAGINA, type FiltrosLlamadas } from "@/lib/calls/queries";
import { formatPhone } from "@/lib/contacts/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Llamadas" };

const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

export default function LlamadasPage({ searchParams }: PageProps<"/llamadas">) {
  return (
    <>
      <PageHeader title="Llamadas" description="Estado, resultado y transcripción de cada llamada." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Listado searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function hrefFiltro(f: FiltrosLlamadas, cambio: Partial<FiltrosLlamadas>) {
  const n = { ...f, ...cambio };
  const p = new URLSearchParams();
  if (n.estados.length) p.set("estado", n.estados.join(","));
  if (n.cita) p.set("cita", "1");
  return `?${p}`;
}

async function Listado({ searchParams }: Pick<PageProps<"/llamadas">, "searchParams">) {
  const filtros = leerFiltrosLlamadas(await searchParams);
  const { llamadas, total } = await listarLlamadas(filtros);
  const hayActivas = llamadas.some((l) => l.estado === "iniciada" || l.estado === "en_curso");

  const params: Record<string, string> = {};
  if (filtros.estados.length) params.estado = filtros.estados.join(",");
  if (filtros.cita) params.cita = "1";

  const chip = (activo: boolean) =>
    cn(buttonVariants({ variant: activo ? "secondary" : "ghost", size: "sm" }), activo && "ring-1 ring-border");

  return (
    <div className="flex flex-col gap-4">
      <AutoRefresco activo={hayActivas} />
      <nav className="flex flex-wrap gap-1" aria-label="Filtrar por estado">
        <Link href={hrefFiltro(filtros, { estados: [], cita: false })} className={chip(!filtros.estados.length && !filtros.cita)}>
          Todas
        </Link>
        {ESTADOS_LLAMADA.map((e) => (
          <Link key={e} href={hrefFiltro(filtros, { estados: [e] })} className={chip(filtros.estados.length === 1 && filtros.estados[0] === e)}>
            {ETIQUETA_LLAMADA[e]}
          </Link>
        ))}
        <Link href={hrefFiltro(filtros, { cita: !filtros.cita })} className={chip(filtros.cita)}>
          Con cita
        </Link>
      </nav>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead className="text-right">Duración</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {llamadas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {filtros.estados.length || filtros.cita ? "Ninguna llamada con estos filtros." : "Todavía no se ha hecho ninguna llamada."}
                </TableCell>
              </TableRow>
            )}
            {llamadas.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap tabular-nums">
                  <Link href={`/llamadas/${l.id}`} className="font-medium hover:underline">
                    {fecha.format(new Date(l.creado_en))}
                  </Link>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{l.contactos?.nombre ?? "—"}</p>
                  {l.contactos && <p className="text-xs text-muted-foreground tabular-nums">{formatPhone(l.contactos.telefono)}</p>}
                </TableCell>
                <TableCell>
                  <EstadoLlamada estado={l.estado} />
                </TableCell>
                <TableCell className="text-sm">
                  {l.cita_agendada && l.fecha_cita
                    ? `Cita: ${fecha.format(new Date(l.fecha_cita))}`
                    : l.estado === "fallida" && l.motivo_fallo
                      ? (MOTIVO_FALLO[l.motivo_fallo] ?? "Error al llamar")
                      : (etiquetaClasificacion(l.clasificacion) ?? "—")}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatearDuracion(l.duracion_seg)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Paginacion pagina={filtros.pagina} total={total} porPagina={POR_PAGINA} params={params} />
    </div>
  );
}

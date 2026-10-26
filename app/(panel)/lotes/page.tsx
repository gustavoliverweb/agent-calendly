import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/panel/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoRefresco } from "@/components/llamadas/auto-refresco";
import { AvisoDespacho } from "@/components/lotes/aviso-despacho";
import { EstadoLoteBadge, ProgresoLote } from "@/components/lotes/progreso";
import { COLOR_LOTE, ETIQUETA_LOTE } from "@/lib/lotes/estados";
import { avisoDespacho, listarLotes } from "@/lib/lotes/queries";

export const metadata: Metadata = { title: "Lotes" };

const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

export default function LotesPage() {
  return (
    <>
      <PageHeader
        title="Lotes"
        description="Llamadas en cola respetando el horario, el límite de llamadas simultáneas y los reintentos. Se crean desde Contactos → seleccionar → “Llamar a seleccionados”."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Listado />
      </Suspense>
    </>
  );
}

async function Listado() {
  const [lotes, aviso] = await Promise.all([listarLotes(), avisoDespacho()]);
  const hayActivos = lotes.some((l) => l.estado === "activo");

  return (
    <div className="flex flex-col gap-4">
      <AutoRefresco activo={hayActivos} cadaMs={10_000} />
      {aviso && hayActivos && <AvisoDespacho texto={aviso} />}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Progreso</TableHead>
              <TableHead className="text-right">Citas</TableHead>
              <TableHead className="hidden md:table-cell">Creado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  Todavía no hay lotes. Selecciona contactos en{" "}
                  <Link href="/contactos" className="underline">
                    Contactos
                  </Link>{" "}
                  y pulsa “Llamar a seleccionados”.
                </TableCell>
              </TableRow>
            )}
            {lotes.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">
                  <Link href={`/lotes/${l.id}`} className="hover:underline">
                    {l.nombre ?? `Lote del ${fecha.format(new Date(l.creado_en))}`}
                  </Link>
                </TableCell>
                <TableCell>
                  <EstadoLoteBadge clase={COLOR_LOTE[l.estado]}>{ETIQUETA_LOTE[l.estado]}</EstadoLoteBadge>
                </TableCell>
                <TableCell>
                  <ProgresoLote progreso={l.progreso} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.citas}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {fecha.format(new Date(l.creado_en))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

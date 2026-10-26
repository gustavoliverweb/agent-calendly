import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoRefresco } from "@/components/llamadas/auto-refresco";
import { EstadoLlamada } from "@/components/llamadas/estado-llamada";
import { AccionesLote } from "@/components/lotes/acciones-lote";
import { AvisoDespacho } from "@/components/lotes/aviso-despacho";
import { EstadoLoteBadge, ProgresoLote } from "@/components/lotes/progreso";
import { etiquetaClasificacion } from "@/lib/calls/estados";
import { formatPhone } from "@/lib/contacts/phone";
import { COLOR_ITEM, COLOR_LOTE, contarItems, ETIQUETA_ITEM, ETIQUETA_LOTE, motivoItem } from "@/lib/lotes/estados";
import { avisoDespacho, obtenerLote } from "@/lib/lotes/queries";

export const metadata: Metadata = { title: "Lote" };

const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

export default function LotePage({ params }: PageProps<"/app/lotes/[id]">) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col">
      <Link href="/app/lotes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Lotes
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Detalle params={params} />
      </Suspense>
    </div>
  );
}

async function Detalle({ params }: Pick<PageProps<"/app/lotes/[id]">, "params">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [lote, aviso] = await Promise.all([obtenerLote(id), avisoDespacho()]);
  if (!lote) notFound();

  const progreso = contarItems(lote.lote_items);
  const citas = lote.llamadas.filter((l) => l.cita_agendada).length;
  const titulo = lote.nombre ?? `Lote del ${fecha.format(new Date(lote.creado_en))}`;

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresco activo={lote.estado === "activo"} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
            <EstadoLoteBadge clase={COLOR_LOTE[lote.estado]}>{ETIQUETA_LOTE[lote.estado]}</EstadoLoteBadge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Creado el {fecha.format(new Date(lote.creado_en))} · {progreso.total} contactos · {citas}{" "}
            {citas === 1 ? "cita conseguida" : "citas conseguidas"}
          </p>
        </div>
        <AccionesLote loteId={lote.id} estado={lote.estado} />
      </div>

      {aviso && lote.estado === "activo" && <AvisoDespacho texto={aviso} />}

      <Card>
        <CardHeader>
          <CardTitle>Progreso</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgresoLote progreso={progreso} detalle />
        </CardContent>
      </Card>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Intentos</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead>Última llamada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lote.lote_items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  {i.contactos ? (
                    <Link href={`/app/contactos/${i.contactos.id}`} className="font-medium hover:underline">
                      {i.contactos.nombre}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {i.contactos && (
                    <div className="text-xs text-muted-foreground tabular-nums">{formatPhone(i.contactos.telefono)}</div>
                  )}
                </TableCell>
                <TableCell>
                  <EstadoLoteBadge clase={COLOR_ITEM[i.estado]}>{ETIQUETA_ITEM[i.estado]}</EstadoLoteBadge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{i.intentos}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {i.estado === "esperando_reintento" && i.proximo_intento_en
                    ? `Próximo intento: ${fecha.format(new Date(i.proximo_intento_en))}`
                    : (motivoItem(i.motivo_omision) ?? "—")}
                </TableCell>
                <TableCell>
                  {i.llamadas ? (
                    <Link href={`/app/llamadas/${i.llamadas.id}`} className="inline-flex items-center gap-2 hover:underline">
                      <EstadoLlamada estado={i.llamadas.estado} />
                      <span className="text-sm text-muted-foreground">
                        {i.llamadas.cita_agendada ? "Cita agendada" : etiquetaClasificacion(i.llamadas.clasificacion)}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

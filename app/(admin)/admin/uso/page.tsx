import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react";
import { PageHeader } from "@/components/panel/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPlataforma } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { claveMes, etiquetaMes, importe, leerMes, mesActual, minutos, minutosTotales, sumarMeses } from "@/lib/uso/calculo";
import { costeMinutoUsd } from "@/lib/uso/consultas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Uso y facturación" };

const entero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const dolares = new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" });

export default function UsoAdminPage({ searchParams }: PageProps<"/admin/uso">) {
  return (
    <div className="flex flex-col">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Empresas
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Uso searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Uso({ searchParams }: Pick<PageProps<"/admin/uso">, "searchParams">) {
  await requireAdminPlataforma();
  await connection();
  const ahora = new Date();
  const mes = leerMes((await searchParams).mes, ahora);
  const esActual = mes === mesActual(ahora);

  const { data: filas, error } = await createAdminClient().rpc("uso_plataforma", { p_mes: mes });
  if (error) throw new Error(`No se pudo cargar el uso: ${error.message}`);
  const coste = costeMinutoUsd();

  const total = filas.reduce(
    (t, f) => {
      const min = minutosTotales(f);
      const imp = importe(min, f.precio_minuto);
      return {
        llamadas: t.llamadas + f.llamadas,
        citas: t.citas + f.citas,
        minutos: t.minutos + min,
        importe: t.importe + (imp ?? 0),
        sinTarifa: t.sinTarifa + (imp == null && min > 0 ? 1 : 0),
      };
    },
    { llamadas: 0, citas: 0, minutos: 0, importe: 0, sinTarifa: 0 },
  );

  const nav = cn(buttonVariants({ variant: "outline", size: "sm" }));

  return (
    <>
      <PageHeader
        title="Uso y facturación"
        description="Uso de cada empresa en el mes natural (zona horaria de la empresa). Los minutos incluyen las pruebas en el navegador."
      >
        <a href={`/admin/uso/csv?mes=${claveMes(mes)}`} className={buttonVariants({ size: "sm" })} download>
          <DownloadIcon /> CSV para facturar
        </a>
      </PageHeader>

      <nav className="mb-4 flex items-center gap-2" aria-label="Mes">
        <Link href={`?mes=${claveMes(sumarMeses(mes, -1))}`} className={nav} aria-label="Mes anterior">
          <ChevronLeftIcon />
        </Link>
        <span className="min-w-40 text-center font-medium capitalize">{etiquetaMes(mes)}</span>
        {esActual ? (
          <span className={cn(nav, "pointer-events-none opacity-40")} aria-hidden>
            <ChevronRightIcon />
          </span>
        ) : (
          <Link href={`?mes=${claveMes(sumarMeses(mes, 1))}`} className={nav} aria-label="Mes siguiente">
            <ChevronRightIcon />
          </Link>
        )}
        {esActual && <Badge variant="outline">Mes en curso</Badge>}
      </nav>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-right">Llamadas</TableHead>
              <TableHead className="hidden text-right md:table-cell">Contestadas</TableHead>
              <TableHead className="text-right">Citas</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Min. llamadas</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Min. pruebas</TableHead>
              <TableHead className="text-right">Minutos</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Tarifa</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="hidden text-right md:table-cell" title="Minutos × COSTE_MINUTO_ESTIMADO">
                Coste ElevenLabs
              </TableHead>
              <TableHead>
                <span className="sr-only">Detalle</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                  No había ninguna empresa dada de alta ese mes.
                </TableCell>
              </TableRow>
            )}
            {filas.map((f) => {
              const min = minutosTotales(f);
              const imp = importe(min, f.precio_minuto);
              const superado = f.limite_minutos_mes != null && esActual && min >= f.limite_minutos_mes;
              return (
                <TableRow key={f.empresa_id}>
                  <TableCell>
                    <Link href={`/admin/empresas/${f.empresa_id}`} className="font-medium hover:underline">
                      {f.nombre}
                    </Link>
                    {f.estado !== "activa" && (
                      <Badge variant="destructive" className="ml-2">
                        Suspendida
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{entero.format(f.llamadas)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{entero.format(f.contestadas)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entero.format(f.citas)}
                    {f.citas_canceladas > 0 && <span className="text-muted-foreground"> ({f.citas_canceladas} canc.)</span>}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{entero.format(minutos(f.segundos))}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{entero.format(minutos(f.segundos_pruebas))}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", superado && "text-destructive")}>
                    {entero.format(min)}
                    {f.limite_minutos_mes != null && (
                      <span className="block text-xs font-normal text-muted-foreground">de {entero.format(f.limite_minutos_mes)}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {f.precio_minuto == null ? "—" : `${entero.format(Number(f.precio_minuto) * 100)} c/min`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{imp == null ? "—" : euros.format(imp)}</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                    {dolares.format(min * coste)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(f.llamadas > 0 || f.pruebas > 0) && (
                      <a
                        href={`/admin/uso/csv?mes=${claveMes(mes)}&empresa=${f.empresa_id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="Detalle de llamadas (sin datos personales)"
                        download
                      >
                        <DownloadIcon className="size-3.5" /> Detalle
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {filas.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{entero.format(total.llamadas)}</TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="text-right tabular-nums">{entero.format(total.citas)}</TableCell>
                <TableCell className="hidden lg:table-cell" />
                <TableCell className="hidden lg:table-cell" />
                <TableCell className="text-right tabular-nums">{entero.format(total.minutos)}</TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right tabular-nums">{euros.format(total.importe)}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{dolares.format(total.minutos * coste)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {total.sinTarifa > 0 && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          {total.sinTarifa === 1 ? "Una empresa con uso no tiene" : `${total.sinTarifa} empresas con uso no tienen`} tarifa: su
          importe no suma en el total. Se fija en la ficha de cada empresa.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        El coste de ElevenLabs es una estimación con {dolares.format(coste)}/min (COSTE_MINUTO_ESTIMADO); el real está en
        la factura de ElevenLabs. Los CSV usan «;» y coma decimal para abrirlos en Excel.
      </p>
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { DownloadIcon } from "lucide-react";
import { PageHeader } from "@/components/panel/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEmpresaActual } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { claveMes, etiquetaMes, importe, minutos, minutosTotales } from "@/lib/uso/calculo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Uso" };

const entero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const tarifa = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 4 });

export default function UsoPage() {
  return (
    <>
      <PageHeader
        title="Uso"
        description="Minutos, llamadas y citas de cada mes. Es la base de la factura: cuentan todos los minutos de conversación, también las pruebas desde el navegador."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  // El mes actual depende de la hora de la petición.
  await connection();
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const [{ data: emp }, { data: meses, error }] = await Promise.all([
    supabase.from("empresas").select("limite_minutos_mes, precio_minuto").eq("id", empresa.id).single(),
    supabase.rpc("uso_mensual", { p_empresa_id: empresa.id, p_meses: 12 }),
  ]);
  if (error) throw new Error(`No se pudo cargar el uso: ${error.message}`);

  const precio = emp?.precio_minuto == null ? null : Number(emp.precio_minuto);
  const limite = emp?.limite_minutos_mes ?? null;
  const actual = meses[0];
  const usados = actual ? minutosTotales(actual) : 0;
  const porcentaje = limite ? Math.min(100, (usados / limite) * 100) : 0;
  const importeActual = importe(usados, precio);

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Este mes{actual && <span className="font-normal text-muted-foreground"> · {etiquetaMes(actual.mes)}</span>}</CardTitle>
          <CardDescription>
            {precio != null ? `Tarifa: ${tarifa.format(precio)} por minuto.` : "Sin tarifa por minuto en la plataforma: consulta tu contrato."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 text-sm">
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {entero.format(usados)} min
              {limite && <span className="text-base font-normal text-muted-foreground"> de {entero.format(limite)}</span>}
            </p>
            {limite ? (
              <>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="Minutos usados del límite mensual"
                  aria-valuenow={Math.round(porcentaje)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      porcentaje >= 100 ? "bg-destructive" : porcentaje >= 80 ? "bg-amber-500" : "bg-primary",
                    )}
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
                {porcentaje >= 100 && (
                  <p className="mt-2 text-destructive">
                    Has alcanzado el límite del mes: no sale ninguna llamada hasta el mes que viene. Contacta con nosotros
                    para ampliarlo.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Sin límite mensual.</p>
            )}
          </div>
          {actual && (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Dato titulo="Llamadas" valor={entero.format(actual.llamadas)} />
              <Dato titulo="Contestadas" valor={entero.format(actual.contestadas)} />
              <Dato titulo="Citas" valor={entero.format(actual.citas)} />
              <Dato titulo="Importe estimado" valor={importeActual == null ? "—" : euros.format(importeActual)} />
            </dl>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Últimos 12 meses</h2>
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Llamadas</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Contestadas</TableHead>
                <TableHead className="text-right">Citas</TableHead>
                <TableHead className="hidden text-right md:table-cell">Min. llamadas</TableHead>
                <TableHead className="hidden text-right md:table-cell">Min. pruebas</TableHead>
                <TableHead className="text-right">Minutos</TableHead>
                {precio != null && <TableHead className="text-right">Importe</TableHead>}
                <TableHead>
                  <span className="sr-only">Descargar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meses.map((m) => {
                const total = minutosTotales(m);
                const vacio = m.llamadas === 0 && m.pruebas === 0;
                return (
                  <TableRow key={m.mes} className={cn(vacio && "text-muted-foreground")}>
                    <TableCell className="capitalize">{etiquetaMes(m.mes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{entero.format(m.llamadas)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{entero.format(m.contestadas)}</TableCell>
                    <TableCell className="text-right tabular-nums" title={m.citas_canceladas ? `${m.citas_canceladas} canceladas después` : undefined}>
                      {entero.format(m.citas)}
                      {m.citas_canceladas > 0 && <span className="text-muted-foreground"> ({m.citas_canceladas} canc.)</span>}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{entero.format(minutos(m.segundos))}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{entero.format(minutos(m.segundos_pruebas))}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{entero.format(total)}</TableCell>
                    {precio != null && <TableCell className="text-right tabular-nums">{euros.format(importe(total, precio) ?? 0)}</TableCell>}
                    <TableCell className="text-right">
                      {!vacio && (
                        // Descarga directa: un <a> normal, no navegación de cliente.
                        <a
                          href={`/app/uso/csv?mes=${claveMes(m.mes)}`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          download
                        >
                          <DownloadIcon className="size-3.5" /> CSV
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          El CSV detalla cada llamada del mes (fecha, tipo, estado, resultado, duración y cita), sin datos de los contactos.
          El importe es orientativo: la factura es la que te enviamos.
        </p>
      </section>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{titulo}</dt>
      <dd className="text-xl font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

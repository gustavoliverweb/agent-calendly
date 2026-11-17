import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { NuevaEmpresa } from "@/components/admin/nueva-empresa";
import { ConcurrenciaGlobal } from "@/components/admin/linea-limites";
import { PageHeader } from "@/components/panel/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPlataforma } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Empresas" };

const entero = new Intl.NumberFormat("es-ES");
const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short" });

const ESTADO_CALENDLY: Record<string, string> = {
  sin_conectar: "sin conectar",
  pendiente: "falta el tipo de evento",
  conectada: "conectado",
  desconectada: "desconectado",
};

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Empresas />
    </Suspense>
  );
}

async function Empresas() {
  await requireAdminPlataforma();
  const supabase = createAdminClient();
  const [{ data: empresas, error }, { data: global }] = await Promise.all([
    supabase.rpc("resumen_empresas"),
    supabase.rpc("concurrencia_global"),
  ]);
  if (error) throw new Error(`No se pudieron cargar las empresas: ${error.message}`);

  return (
    <>
      <PageHeader title="Empresas" description="Clientes de la plataforma. Uso de los últimos 30 días.">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/uso" className={buttonVariants({ variant: "outline" })}>
            Uso y facturación
          </Link>
          <NuevaEmpresa />
        </div>
      </PageHeader>
      {global?.[0] && (
        <div className="mb-6 rounded-xl border p-4">
          <ConcurrenciaGlobal maximo={global[0].maximo} activas={global[0].activas} />
        </div>
      )}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden lg:table-cell">Puesta en marcha</TableHead>
              <TableHead className="text-right">Miembros</TableHead>
              <TableHead className="text-right">Contactos</TableHead>
              <TableHead className="text-right">Llamadas</TableHead>
              <TableHead className="text-right">Minutos</TableHead>
              <TableHead className="hidden md:table-cell">Alta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Link href={`/admin/empresas/${e.id}`} className="font-medium hover:underline">
                    {e.nombre}
                  </Link>
                  <span className="block font-mono text-xs text-muted-foreground">{e.slug}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={e.estado === "activa" ? "secondary" : "destructive"}>
                    {e.estado === "activa" ? "Activa" : "Suspendida"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-xs lg:table-cell">
                  <span className={e.guion_activo ? "" : "text-destructive"}>
                    {e.guion_activo ? "Guion activo" : "Sin guion"}
                  </span>
                  <span className="block text-muted-foreground">Calendly: {ESTADO_CALENDLY[e.calendly] ?? e.calendly}</span>
                  <span className="block text-muted-foreground">
                    Línea: {e.phone_number_id ? (e.telefono_numero ?? "asignada") : "sin línea"}
                    {e.limite_minutos_mes ? ` · ${Number(e.minutos_mes)}/${e.limite_minutos_mes} min este mes` : ""}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{e.miembros}</TableCell>
                <TableCell className="text-right tabular-nums">{entero.format(e.contactos)}</TableCell>
                <TableCell className="text-right tabular-nums">{entero.format(e.llamadas_30d)}</TableCell>
                <TableCell className="text-right tabular-nums">{entero.format(Math.round(Number(e.segundos_30d) / 60))}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{fecha.format(new Date(e.creado_en))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

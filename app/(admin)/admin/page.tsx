import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { NuevaEmpresa } from "@/components/admin/nueva-empresa";
import { PageHeader } from "@/components/panel/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPlataforma } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Empresas" };

const entero = new Intl.NumberFormat("es-ES");
const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short" });

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Empresas />
    </Suspense>
  );
}

async function Empresas() {
  await requireAdminPlataforma();
  const { data: empresas, error } = await createAdminClient().rpc("resumen_empresas");
  if (error) throw new Error(`No se pudieron cargar las empresas: ${error.message}`);

  return (
    <>
      <PageHeader title="Empresas" description="Clientes de la plataforma. Uso de los últimos 30 días.">
        <NuevaEmpresa />
      </PageHeader>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Estado</TableHead>
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

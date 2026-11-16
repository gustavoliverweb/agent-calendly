import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { AccionesEmpresa } from "@/components/admin/acciones-empresa";
import { Equipo } from "@/components/equipo/equipo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPlataforma } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { accesoEnEmpresa, cambiarRolEnEmpresa, invitarEnEmpresa, quitarDeEmpresa } from "../../actions";

export const metadata: Metadata = { title: "Empresa" };

const entero = new Intl.NumberFormat("es-ES");
const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "long" });

export default function EmpresaPage({ params }: PageProps<"/admin/empresas/[id]">) {
  return (
    <div className="flex flex-col">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Empresas
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Detalle params={params} />
      </Suspense>
    </div>
  );
}

async function Detalle({ params }: Pick<PageProps<"/admin/empresas/[id]">, "params">) {
  const admin = await requireAdminPlataforma();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = createAdminClient();
  const [{ data: resumen }, { data: miembros, error }] = await Promise.all([
    supabase.rpc("resumen_empresas"),
    supabase.rpc("equipo_empresa", { p_empresa_id: id }),
  ]);
  const empresa = resumen?.find((e) => e.id === id);
  if (!empresa) notFound();
  if (error) throw new Error(`No se pudo cargar el equipo: ${error.message}`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{empresa.nombre}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{empresa.slug}</span> · alta el {fecha.format(new Date(empresa.creado_en))}
            <Badge variant={empresa.estado === "activa" ? "secondary" : "destructive"}>
              {empresa.estado === "activa" ? "Activa" : "Suspendida"}
            </Badge>
          </p>
        </div>
        <AccionesEmpresa empresaId={empresa.id} nombre={empresa.nombre} estado={empresa.estado} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Dato titulo="Guion" valor={empresa.guion_activo ? "Activo" : "Sin guion"} />
        <Dato
          titulo="Calendly"
          valor={({ sin_conectar: "Sin conectar", pendiente: "Falta el tipo de evento", conectada: "Conectado", desconectada: "Desconectado" } as Record<string, string>)[empresa.calendly] ?? empresa.calendly}
        />
        <Dato titulo="Miembros" valor={entero.format(empresa.miembros)} />
        <Dato titulo="Contactos" valor={entero.format(empresa.contactos)} />
        <Dato titulo="Llamadas (30 días)" valor={entero.format(empresa.llamadas_30d)} />
        <Dato titulo="Minutos (30 días)" valor={entero.format(Math.round(Number(empresa.segundos_30d) / 60))} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Equipo</h2>
        <Equipo
          miembros={miembros}
          yo={admin.id}
          gestionar
          acciones={{
            invitar: invitarEnEmpresa.bind(null, empresa.id),
            cambiarRol: cambiarRolEnEmpresa.bind(null, empresa.id),
            quitar: quitarDeEmpresa.bind(null, empresa.id),
            nuevoAcceso: accesoEnEmpresa.bind(null, empresa.id),
          }}
        />
      </section>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-semibold tabular-nums">{valor}</CardContent>
    </Card>
  );
}

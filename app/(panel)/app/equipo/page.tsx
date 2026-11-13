import type { Metadata } from "next";
import { Suspense } from "react";
import { Equipo } from "@/components/equipo/equipo";
import { PageHeader } from "@/components/panel/page-header";
import { getCurrentUser } from "@/lib/auth";
import { getEmpresaActual } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { cambiarRol, generarAcceso, invitar, quitar } from "./actions";

export const metadata: Metadata = { title: "Equipo" };

export default function EquipoPage() {
  return (
    <>
      <PageHeader title="Equipo" description="Quién tiene acceso al panel de tu empresa." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Listado />
      </Suspense>
    </>
  );
}

async function Listado() {
  const [user, empresa] = await Promise.all([getCurrentUser(), getEmpresaActual()]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("equipo_empresa", { p_empresa_id: empresa.id });
  if (error) throw new Error(`No se pudo cargar el equipo: ${error.message}`);

  return (
    <div className="flex flex-col gap-4">
      {empresa.rol !== "propietario" && (
        <p className="text-sm text-muted-foreground">Solo el propietario de la empresa puede invitar o quitar miembros.</p>
      )}
      <Equipo
        miembros={data}
        yo={user.id}
        gestionar={empresa.rol === "propietario"}
        acciones={{ invitar, cambiarRol, quitar, nuevoAcceso: generarAcceso }}
      />
    </div>
  );
}

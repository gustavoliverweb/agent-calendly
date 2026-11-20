import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { EditorMarcaPlataforma } from "@/components/admin/editor-marca-plataforma";
import { PageHeader } from "@/components/panel/page-header";
import { requireAdminPlataforma } from "@/lib/admin";
import { urlImagenMarca } from "@/lib/dominio/imagen";
import { MARCA_POR_DEFECTO } from "@/lib/marca";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Marca de la plataforma" };

export default function MarcaPlataformaPage() {
  return (
    <div className="flex flex-col">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Empresas
      </Link>
      <PageHeader
        title="Marca de la plataforma"
        description="Nombre, descripción, email, logo y favicon de la web pública, de la pantalla de acceso y de esta administración. Cada empresa tiene además su propia marca en su panel."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  await requireAdminPlataforma();
  // Sin caché: el formulario muestra lo que hay guardado ahora mismo.
  const { data, error } = await createAdminClient()
    .from("ajustes_plataforma")
    .select("marca_nombre, marca_descripcion, marca_email, marca_logo, marca_favicon")
    .eq("id", true)
    .single();
  if (error) throw new Error(`No se pudo leer la marca: ${error.message}`);

  return (
    <EditorMarcaPlataforma
      inicial={{ nombre: data.marca_nombre ?? "", descripcion: data.marca_descripcion ?? "", email: data.marca_email ?? "" }}
      porDefecto={MARCA_POR_DEFECTO}
      logoUrl={urlImagenMarca(data.marca_logo)}
      faviconUrl={urlImagenMarca(data.marca_favicon)}
    />
  );
}

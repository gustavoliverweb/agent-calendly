import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { UploadIcon } from "lucide-react";
import { PageHeader } from "@/components/panel/page-header";
import { buttonVariants } from "@/components/ui/button";
import { FiltrosContactos } from "@/components/contactos/filtros";
import { NuevoContacto } from "@/components/contactos/nuevo-contacto";
import { Paginacion } from "@/components/contactos/paginacion";
import { TablaContactos } from "@/components/contactos/tabla-contactos";
import { contarPorEstado, leerFiltros, listarContactos, POR_PAGINA } from "@/lib/contacts/queries";

export const metadata: Metadata = { title: "Contactos" };

export default function ContactosPage({ searchParams }: PageProps<"/contactos">) {
  return (
    <>
      <PageHeader title="Contactos" description="Importa, busca y gestiona a quién llama el agente.">
        <div className="flex gap-2">
          <NuevoContacto />
          <Link href="/contactos/importar" className={buttonVariants()}>
            <UploadIcon data-icon="inline-start" />
            Importar CSV
          </Link>
        </div>
      </PageHeader>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Listado searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Listado({ searchParams }: Pick<PageProps<"/contactos">, "searchParams">) {
  const filtros = leerFiltros(await searchParams);
  const [{ contactos, total }, totales] = await Promise.all([listarContactos(filtros), contarPorEstado()]);

  const params: Record<string, string> = {};
  if (filtros.q) params.q = filtros.q;
  if (filtros.estados.length) params.estado = filtros.estados.join(",");
  if (filtros.seguimiento) params.seguimiento = "1";

  return (
    <div className="flex flex-col gap-4">
      <FiltrosContactos totales={totales} />
      <TablaContactos key={JSON.stringify(params) + filtros.pagina} contactos={contactos} />
      <Paginacion pagina={filtros.pagina} total={total} porPagina={POR_PAGINA} params={params} />
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { PageHeader } from "@/components/panel/page-header";
import { buttonVariants } from "@/components/ui/button";
import { FiltrosContactos } from "@/components/contactos/filtros";
import { NuevoContacto } from "@/components/contactos/nuevo-contacto";
import { Paginacion } from "@/components/contactos/paginacion";
import { TablaContactos } from "@/components/contactos/tabla-contactos";
import { contarPorEstado, leerFiltros, listarContactos, POR_PAGINA } from "@/lib/contacts/queries";

export const metadata: Metadata = { title: "Contactos" };

const entero = new Intl.NumberFormat("es-ES");

export default function ContactosPage({ searchParams }: PageProps<"/app/contactos">) {
  return (
    <>
      <PageHeader title="Contactos" description="Importa, busca y gestiona a quién llama el agente.">
        <div className="flex gap-2">
          <NuevoContacto />
          <Link href="/app/contactos/importar" className={buttonVariants()}>
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

async function Listado({ searchParams }: Pick<PageProps<"/app/contactos">, "searchParams">) {
  const filtros = leerFiltros(await searchParams);
  const [{ contactos, total }, totales] = await Promise.all([listarContactos(filtros), contarPorEstado()]);

  const params: Record<string, string> = {};
  if (filtros.q) params.q = filtros.q;
  if (filtros.estados.length) params.estado = filtros.estados.join(",");
  if (filtros.seguimiento) params.seguimiento = "1";
  const hayFiltros = Object.keys(params).length > 0;

  return (
    <div className="flex flex-col gap-4">
      <FiltrosContactos totales={totales} />
      {total > 0 && (
        <div className="-mt-1 flex justify-end">
          {/* Enlace normal (no Link): es una descarga, no una navegación. */}
          <a
            href={`/app/contactos/exportar?${new URLSearchParams(params)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            download
          >
            <DownloadIcon data-icon="inline-start" />
            {hayFiltros ? `Exportar ${entero.format(total)} filtrados` : "Exportar CSV"}
          </a>
        </div>
      )}
      <TablaContactos key={JSON.stringify(params) + filtros.pagina} contactos={contactos} />
      <Paginacion pagina={filtros.pagina} total={total} porPagina={POR_PAGINA} params={params} />
    </div>
  );
}

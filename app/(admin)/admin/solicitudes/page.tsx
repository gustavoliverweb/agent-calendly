import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { EstadoSolicitud } from "@/components/admin/estado-solicitud";
import { PageHeader } from "@/components/panel/page-header";
import { Badge } from "@/components/ui/badge";
import { requireAdminPlataforma } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Solicitudes de la web" };

const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });
const FILTROS = [
  { valor: "nueva", texto: "Nuevas" },
  { valor: "atendida", texto: "Atendidas" },
  { valor: "descartada", texto: "Descartadas" },
  { valor: "todas", texto: "Todas" },
] as const;

export default function SolicitudesPage({ searchParams }: PageProps<"/admin/solicitudes">) {
  return (
    <div className="flex flex-col">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Empresas
      </Link>
      <PageHeader
        title="Solicitudes de la web"
        description="Lo que llega por el formulario de «Solicitar una demo». Se borran solas 12 meses después del último cambio."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Listado searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Listado({ searchParams }: Pick<PageProps<"/admin/solicitudes">, "searchParams">) {
  await requireAdminPlataforma();
  const valor = (await searchParams).estado;
  const filtro = FILTROS.find((f) => f.valor === valor)?.valor ?? "nueva";

  let consulta = createAdminClient()
    .from("solicitudes_contacto")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(200);
  if (filtro !== "todas") consulta = consulta.eq("estado", filtro);
  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron cargar las solicitudes: ${error.message}`);

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-1" aria-label="Filtrar por estado">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={`?estado=${f.valor}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm",
              f.valor === filtro ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.texto}
          </Link>
        ))}
      </nav>
      {data.length === 0 ? (
        <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No hay solicitudes en este estado.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((s) => (
            <li key={s.id} className="rounded-xl border p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {s.nombre}
                    {s.empresa && <span className="font-normal text-muted-foreground"> · {s.empresa}</span>}
                    {s.estado !== "nueva" && (
                      <Badge variant="outline" className="ml-2">
                        {s.estado === "atendida" ? "Atendida" : "Descartada"}
                      </Badge>
                    )}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    <a href={`mailto:${s.email}`} className="underline underline-offset-2 hover:text-foreground">
                      {s.email}
                    </a>
                    {s.telefono && (
                      <>
                        {" · "}
                        <a href={`tel:${s.telefono.replace(/\s+/g, "")}`} className="hover:text-foreground">
                          {s.telefono}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <EstadoSolicitud id={s.id} estado={s.estado} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {fecha.format(new Date(s.creado_en))}
                {s.sector && ` · ${s.sector}`}
                {s.volumen && ` · ${s.volumen} leads/mes`}
                {s.origen && ` · desde ${s.origen}`}
              </p>
              {s.mensaje && <p className="mt-3 whitespace-pre-line">{s.mensaje}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

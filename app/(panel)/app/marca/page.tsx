import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorMarca } from "@/components/marca/editor-marca";
import { PageHeader } from "@/components/panel/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { origenEmpresa, urlImagenMarca } from "@/lib/dominio/contexto";
import { getEmpresaActual } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Marca" };

const ESTADO: Record<string, string> = { verificado: "Activo", pendiente: "Pendiente de DNS", error: "Con error" };

export default function MarcaPage() {
  return (
    <>
      <PageHeader title="Marca" description="Tu nombre, logo y colores en el panel, y los datos de tus páginas legales." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const empresa = await getEmpresaActual();
  const supabase = await createClient();
  const [{ data: e, error }, { data: dominios }, direccion] = await Promise.all([
    supabase
      .from("empresas")
      .select("nombre, marca_nombre, marca_color, marca_logo, marca_favicon, legal_razon_social, legal_nif, legal_domicilio, legal_registro, legal_email")
      .eq("id", empresa.id)
      .single(),
    supabase.from("dominios_empresa").select("id, dominio, estado").eq("empresa_id", empresa.id).order("creado_en"),
    origenEmpresa(empresa.id),
  ]);
  if (error) throw new Error(`No se pudo cargar la marca: ${error.message}`);
  const editable = empresa.rol === "propietario";

  return (
    <div className="flex flex-col gap-6">
      {!editable && (
        <p className="max-w-3xl text-sm text-muted-foreground">Solo el propietario de la empresa puede cambiar la marca.</p>
      )}
      <EditorMarca
        editable={editable}
        nombreEmpresa={e.nombre}
        logoUrl={urlImagenMarca(e.marca_logo)}
        faviconUrl={urlImagenMarca(e.marca_favicon)}
        inicial={{
          nombre: e.marca_nombre ?? "",
          color: e.marca_color ?? "",
          razonSocial: e.legal_razon_social ?? "",
          nif: e.legal_nif ?? "",
          domicilio: e.legal_domicilio ?? "",
          registro: e.legal_registro ?? "",
          email: e.legal_email ?? "",
        }}
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dirección del panel</CardTitle>
          <CardDescription>
            Tu equipo entra por <span className="font-mono text-foreground">{direccion}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {dominios?.length ? (
            <ul className="flex flex-col gap-1">
              {dominios.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <span className="font-mono">{d.dominio}</span>
                  <Badge variant={d.estado === "verificado" ? "secondary" : "outline"}>{ESTADO[d.estado] ?? d.estado}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-muted-foreground">
            ¿Quieres usar tu propio dominio (p. ej. <span className="font-mono">llamadas.tuempresa.com</span>)? Pídenoslo: te
            diremos qué registro CNAME crear en tu DNS y lo activamos con HTTPS.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

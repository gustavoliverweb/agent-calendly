import { Suspense } from "react";
import { PaginaAcceso, metadataAcceso } from "@/components/marca/pagina-acceso";
import { marcaPlataforma } from "@/lib/marca-plataforma";

export const generateMetadata = () => metadataAcceso("Sin acceso");

/**
 * Usuario con sesión sin acceso: no pertenece a ninguna empresa (p. ej. le
 * quitaron el acceso) o no es miembro de la empresa de este dominio.
 */
export default function SinEmpresaPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-white" />}>
      <PaginaAcceso etiqueta="Cuenta" titulo="Tu usuario no tiene acceso a este panel." volver="web">
        {(ctx) => (
          <>
            <p className="text-sm text-neutral-500">
              {ctx.tipo === "empresa" ? (
                `Pide a quien gestiona ${ctx.empresa.marca.nombre} que te invite${ctx.empresa.legal.email ? ` o escribe a ${ctx.empresa.legal.email}` : ""}.`
              ) : (
                <>
                  Pide a quien gestiona tu empresa que te invite de nuevo, o escríbenos a <EmailPlataforma />.
                </>
              )}
            </p>
            <form action="/auth/salir" method="post" className="mt-8">
              <button type="submit" className="text-sm underline underline-offset-4 hover:text-neutral-600">
                Cerrar sesión
              </button>
            </form>
          </>
        )}
      </PaginaAcceso>
    </Suspense>
  );
}

async function EmailPlataforma() {
  return <>{(await marcaPlataforma()).email}</>;
}

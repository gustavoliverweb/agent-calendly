import { Suspense } from "react";
import { PaginaAcceso, metadataAcceso } from "@/components/marca/pagina-acceso";
import { PasswordForm } from "./password-form";

export const generateMetadata = () => metadataAcceso("Contraseña");

export default function ContrasenaPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-white" />}>
      <PaginaAcceso etiqueta="Cuenta" titulo="Elige tu contraseña." subtitulo="Mínimo 10 caracteres." volver="panel">
        {() => <PasswordForm />}
      </PaginaAcceso>
    </Suspense>
  );
}

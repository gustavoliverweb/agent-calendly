import { Suspense } from "react";
import { PaginaAcceso, metadataAcceso } from "@/components/marca/pagina-acceso";
import { LoginForm } from "./login-form";

export const generateMetadata = () => metadataAcceso("Entrar");

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-white" />}>
      <PaginaAcceso
        etiqueta="Panel"
        titulo="Entra en tu panel."
        subtitulo="Acceso solo para usuarios invitados."
        volver="web"
      >
        {() => <LoginForm />}
      </PaginaAcceso>
    </Suspense>
  );
}

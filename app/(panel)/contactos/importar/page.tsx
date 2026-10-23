import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/panel/page-header";
import { ImportarWizard } from "@/components/contactos/importar-wizard";

export const metadata: Metadata = { title: "Importar contactos" };

export default function ImportarPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <Link href="/contactos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Contactos
      </Link>
      <PageHeader
        title="Importar contactos"
        description="Se valida cada teléfono (formato E.164) y se detectan duplicados antes de importar."
      />
      <ImportarWizard />
    </div>
  );
}

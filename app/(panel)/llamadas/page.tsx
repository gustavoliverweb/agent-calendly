import type { Metadata } from "next";
import { PageHeader } from "@/components/panel/page-header";
import { ComingSoon } from "@/components/panel/coming-soon";

export const metadata: Metadata = { title: "Llamadas" };

export default function LlamadasPage() {
  return (
    <>
      <PageHeader title="Llamadas" description="Estado, resultado y transcripción de cada llamada." />
      <ComingSoon fase={5}>Listado y detalle de llamadas con transcripción y enlace a la cita.</ComingSoon>
    </>
  );
}

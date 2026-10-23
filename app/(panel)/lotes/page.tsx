import type { Metadata } from "next";
import { PageHeader } from "@/components/panel/page-header";
import { ComingSoon } from "@/components/panel/coming-soon";

export const metadata: Metadata = { title: "Lotes" };

export default function LotesPage() {
  return (
    <>
      <PageHeader title="Lotes" description="Llamadas en lote con concurrencia, franjas y reintentos." />
      <ComingSoon fase={6}>Progreso de cada lote y acciones de pausar, reanudar y cancelar.</ComingSoon>
    </>
  );
}

import { Bricolage_Grotesque } from "next/font/google";
import { Cabecera } from "@/components/landing/cabecera";
import { Pie } from "@/components/landing/pie";
import type { Metadata } from "next";
import { marcaPlataforma } from "@/lib/marca-plataforma";
import { cn } from "@/lib/utils";

/** Tipografía de la web pública (el panel sigue con la del sistema de diseño). */
const bricolage = Bricolage_Grotesque({
  variable: "--font-web",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "wdth"],
});

/** El favicon de la plataforma, si se ha subido en /admin → Marca (solo en su web, no en los paneles de las empresas). */
export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaPlataforma();
  return marca.faviconUrl ? { icons: { icon: marca.faviconUrl } } : {};
}

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const marca = await marcaPlataforma();
  return (
    <div className={cn(bricolage.variable, "web flex min-h-full flex-1 flex-col bg-white")}>
      <Cabecera nombre={marca.nombre} logoUrl={marca.logoUrl} />
      {children}
      <Pie />
    </div>
  );
}

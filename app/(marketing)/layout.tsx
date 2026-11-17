import { Bricolage_Grotesque } from "next/font/google";
import { Cabecera } from "@/components/landing/cabecera";
import { Pie } from "@/components/landing/pie";
import { cn } from "@/lib/utils";

/** Tipografía de la web pública (el panel sigue con la del sistema de diseño). */
const bricolage = Bricolage_Grotesque({
  variable: "--font-web",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "wdth"],
});

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={cn(bricolage.variable, "web flex min-h-full flex-1 flex-col bg-white")}>
      <Cabecera />
      {children}
      <Pie />
    </div>
  );
}

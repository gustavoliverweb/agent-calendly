import { Cabecera } from "@/components/landing/cabecera";
import { Pie } from "@/components/landing/pie";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <Cabecera />
      {children}
      <Pie />
    </div>
  );
}

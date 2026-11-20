import { Logo } from "@/components/marca/logo";
import { marcaPlataforma } from "@/lib/marca-plataforma";

/** Logo de la plataforma para componentes de servidor (lee la marca vigente). */
export async function LogoPlataforma({ className }: { className?: string }) {
  const m = await marcaPlataforma();
  return <Logo nombre={m.nombre} logoUrl={m.logoUrl} className={className} />;
}

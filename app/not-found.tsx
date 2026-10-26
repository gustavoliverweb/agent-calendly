import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-5xl font-semibold text-muted-foreground tabular-nums">404</p>
      <div>
        <h1 className="text-lg font-semibold">Esta página no existe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Puede que el contacto, la llamada o el lote se haya borrado, o que el enlace esté
          incompleto.
        </p>
      </div>
      <Link href="/" className={buttonVariants()}>
        Ir al resumen
      </Link>
    </main>
  );
}

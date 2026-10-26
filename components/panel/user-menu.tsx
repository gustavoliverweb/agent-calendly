import Link from "next/link";
import { KeyRoundIcon, LogOutIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";

/** Lee la sesión: renderizar siempre dentro de un <Suspense>. */
export async function UserMenu() {
  const user = await getCurrentUser();

  return (
    <div className="flex items-center gap-1">
      <span className="mr-2 hidden text-sm text-muted-foreground md:inline">{user.email}</span>
      <Link
        href="/cuenta/contrasena"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        title="Cambiar contraseña"
      >
        <KeyRoundIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Contraseña</span>
      </Link>
      <form action="/auth/salir" method="post">
        <Button type="submit" variant="ghost" size="sm">
          <LogOutIcon data-icon="inline-start" />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </form>
    </div>
  );
}

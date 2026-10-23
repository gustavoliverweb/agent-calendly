import { LogOutIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

/** Lee la sesión: renderizar siempre dentro de un <Suspense>. */
export async function UserMenu() {
  const user = await getCurrentUser();

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
      <form action="/auth/salir" method="post">
        <Button type="submit" variant="ghost" size="sm">
          <LogOutIcon data-icon="inline-start" />
          Salir
        </Button>
      </form>
    </div>
  );
}

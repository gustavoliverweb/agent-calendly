"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Error al cargar una sección del panel: el layout (menú, pausa global) sigue disponible. */
export default function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : undefined;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <TriangleAlertIcon className="size-8 text-destructive" />
      <div>
        <h1 className="text-lg font-semibold">No se ha podido cargar esta página</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Puede ser un problema momentáneo de conexión con la base de datos. Si se repite, comparte
          este código con soporte para localizar el error en los registros.
        </p>
        {digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Código: {digest}</p>}
      </div>
      <Button onClick={() => retry()}>
        <RotateCcwIcon data-icon="inline-start" />
        Reintentar
      </Button>
    </div>
  );
}

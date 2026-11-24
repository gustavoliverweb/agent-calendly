"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Error al cargar una sección del panel: el layout (menú, pausa global) sigue disponible. */
export default function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : undefined;
  // Sin digest el fallo fue en el navegador: no queda en los registros del
  // servidor, así que se enseña el mensaje para poder diagnosticarlo.
  const detalle = !digest && error instanceof Error ? error.message.slice(0, 300) : undefined;
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
        {detalle && <p className="mt-2 font-mono text-xs break-words text-muted-foreground">Detalle: {detalle}</p>}
      </div>
      <Button onClick={() => retry()}>
        <RotateCcwIcon data-icon="inline-start" />
        Reintentar
      </Button>
    </div>
  );
}

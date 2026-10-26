"use client";

import { useState, useTransition } from "react";
import { OctagonPauseIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cambiarPausaGlobal } from "@/app/(panel)/configuracion/actions";

/**
 * Interruptor de emergencia. Activarlo es inmediato (es el caso urgente);
 * reanudar pide confirmación porque vuelve a lanzar llamadas.
 */
export function PausaGlobal({ activa }: { activa: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirmar, setConfirmar] = useState(false);

  function cambiar(activar: boolean) {
    startTransition(async () => {
      const r = await cambiarPausaGlobal(activar);
      if (r.error) toast.error(r.error);
      else toast.success(activar ? "Pausa global activada: no se lanzarán llamadas nuevas" : "Llamadas reanudadas");
      setConfirmar(false);
    });
  }

  return (
    <>
      {activa ? (
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => setConfirmar(true)}>
          <PlayIcon data-icon="inline-start" />
          <span className="hidden sm:inline">Pausa global activa ·</span> Reanudar
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={pending}
          onClick={() => cambiar(true)}
          title="Detiene al instante el lanzamiento de llamadas nuevas. Las que están sonando terminan."
        >
          <OctagonPauseIcon data-icon="inline-start" />
          Pausa global
        </Button>
      )}

      <AlertDialog open={confirmar} onOpenChange={(open) => !open && setConfirmar(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reanudar las llamadas?</AlertDialogTitle>
            <AlertDialogDescription>
              Los lotes activos volverán a lanzar llamadas en cuanto estemos dentro del horario permitido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button disabled={pending} onClick={() => cambiar(false)}>
              {pending ? "Reanudando…" : "Reanudar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

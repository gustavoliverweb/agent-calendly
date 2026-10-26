"use client";

import { useState, useTransition } from "react";
import { PauseIcon, PlayIcon, XIcon } from "lucide-react";
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
import { cambiarEstadoLote } from "@/app/(panel)/lotes/actions";
import type { LoteEstado } from "@/lib/lotes/estados";

const OK = { pausar: "Lote pausado", reanudar: "Lote reanudado", cancelar: "Lote cancelado" } as const;

export function AccionesLote({ loteId, estado }: { loteId: string; estado: LoteEstado }) {
  const [pending, startTransition] = useTransition();
  const [confirmar, setConfirmar] = useState(false);

  function ejecutar(accion: "pausar" | "reanudar" | "cancelar") {
    startTransition(async () => {
      const r = await cambiarEstadoLote(loteId, accion);
      if (r.error) toast.error(r.error);
      else toast.success(OK[accion]);
      setConfirmar(false);
    });
  }

  if (estado !== "activo" && estado !== "pausado") return null;
  return (
    <div className="flex gap-2">
      {estado === "activo" ? (
        <Button variant="outline" disabled={pending} onClick={() => ejecutar("pausar")}>
          <PauseIcon data-icon="inline-start" />
          Pausar
        </Button>
      ) : (
        <Button disabled={pending} onClick={() => ejecutar("reanudar")}>
          <PlayIcon data-icon="inline-start" />
          Reanudar
        </Button>
      )}
      <Button variant="ghost" className="text-destructive" disabled={pending} onClick={() => setConfirmar(true)}>
        <XIcon data-icon="inline-start" />
        Cancelar lote
      </Button>

      <AlertDialog open={confirmar} onOpenChange={(open) => !open && setConfirmar(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar el lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Los contactos que quedaban en cola o esperando reintento no se llamarán. Las llamadas que están sonando
              ahora terminan con normalidad. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
            <Button variant="destructive" disabled={pending} onClick={() => ejecutar("cancelar")}>
              {pending ? "Cancelando…" : "Cancelar lote"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

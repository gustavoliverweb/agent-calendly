"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { borrarContacto, marcarNoLlamar } from "@/app/(panel)/app/contactos/actions";

export function ZonaExclusion({ id, nombre, noLlamar }: { id: string; nombre: string; noLlamar: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirmacion, setConfirmacion] = useState("");
  const [abierto, setAbierto] = useState<"no_llamar" | "borrar" | null>(null);

  function ejecutar(accion: () => Promise<{ error?: string }>, ok: string) {
    startTransition(async () => {
      const r = await accion();
      if (r?.error) toast.error(r.error);
      else toast.success(ok);
      setAbierto(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">Lista de exclusión</p>
          <p className="text-muted-foreground">
            {noLlamar ? "Este contacto no se volverá a llamar." : "Excluye al contacto de forma permanente."}
          </p>
        </div>
        <AlertDialog open={abierto === "no_llamar"} onOpenChange={(o) => setAbierto(o ? "no_llamar" : null)}>
          <AlertDialogTrigger render={<Button variant="destructive" disabled={noLlamar} />}>
            {noLlamar ? "Ya está en “no llamar”" : "Marcar “no llamar”"}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Marcar a {nombre} como “no llamar”?</AlertDialogTitle>
              <AlertDialogDescription>
                Es permanente: no se le volverá a llamar y se retira de los lotes pendientes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => ejecutar(() => marcarNoLlamar([id]), "Marcado como “no llamar”")}
              >
                Marcar “no llamar”
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">Borrar datos (RGPD)</p>
          <p className="text-muted-foreground">
            Elimina el contacto, sus llamadas, transcripciones y citas, también en ElevenLabs. No se puede deshacer.
          </p>
        </div>
        <AlertDialog
          open={abierto === "borrar"}
          onOpenChange={(o) => {
            setAbierto(o ? "borrar" : null);
            setConfirmacion("");
          }}
        >
          <AlertDialogTrigger render={<Button variant="outline" className="text-destructive" />}>
            Borrar contacto
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar todos los datos de {nombre}?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminan el contacto, sus llamadas, transcripciones y citas registradas en el panel, y sus conversaciones en ElevenLabs. La cita en Calendly, si la hay, no se toca. Escribe{" "}
                <strong>BORRAR</strong> para confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} aria-label="Confirmación" />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={pending || confirmacion !== "BORRAR"}
                onClick={() => ejecutar(() => borrarContacto(id), "Contacto borrado")}
              >
                {pending ? "Borrando…" : "Borrar definitivamente"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

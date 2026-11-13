"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cambiarEstadoEmpresa, renombrarEmpresa } from "@/app/(admin)/admin/actions";

export function AccionesEmpresa({ empresaId, nombre, estado }: { empresaId: string; nombre: string; estado: string }) {
  const [pending, startTransition] = useTransition();
  const [renombrando, setRenombrando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(nombre);
  const [suspendiendo, setSuspendiendo] = useState(false);

  function cambiarEstado(nuevo: "activa" | "suspendida") {
    startTransition(async () => {
      const r = await cambiarEstadoEmpresa(empresaId, nuevo);
      if (r.error) toast.error(r.error);
      else toast.success(nuevo === "activa" ? "Empresa reactivada" : "Empresa suspendida");
      setSuspendiendo(false);
    });
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={pending} onClick={() => setRenombrando(true)}>
        Cambiar nombre
      </Button>
      {estado === "activa" ? (
        <Button variant="ghost" className="text-destructive" disabled={pending} onClick={() => setSuspendiendo(true)}>
          Suspender
        </Button>
      ) : (
        <Button disabled={pending} onClick={() => cambiarEstado("activa")}>
          Reactivar
        </Button>
      )}

      <Dialog open={renombrando} onOpenChange={setRenombrando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar nombre</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const r = await renombrarEmpresa(empresaId, nuevoNombre);
                if (r.error) toast.error(r.error);
                else {
                  toast.success("Nombre cambiado");
                  setRenombrando(false);
                }
              });
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="renombrar">Nombre</Label>
              <Input id="renombrar" required value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
            </div>
            <Button type="submit" disabled={pending}>
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={suspendiendo} onOpenChange={(o) => !o && setSuspendiendo(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Suspender {nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              No saldrá ninguna llamada nueva, ni manual ni de sus lotes, hasta que la reactives. Su equipo podrá seguir
              entrando y viendo sus datos. Las llamadas en curso terminan con normalidad.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
            <Button variant="destructive" disabled={pending} onClick={() => cambiarEstado("suspendida")}>
              {pending ? "Suspendiendo…" : "Suspender"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhoneIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearLote } from "@/app/(panel)/lotes/actions";
import { MOTIVO_ITEM } from "@/lib/lotes/estados";

const MOTIVOS: Record<string, string> = { ...MOTIVO_ITEM, no_encontrado: "Ya no existe" };

/** "Llamar a seleccionados": crea un lote y lleva a su página. */
export function CrearLote({ ids, onCreado }: { ids: string[]; onCreado: () => void }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function crear() {
    startTransition(async () => {
      const r = await crearLote(ids, nombre);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const omitidos = Object.entries(r.omitidos);
      toast.success(`Lote creado: ${r.encolados} ${r.encolados === 1 ? "contacto" : "contactos"} en cola`, {
        description: omitidos.length
          ? `Omitidos: ${omitidos.map(([m, n]) => `${n} · ${MOTIVOS[m] ?? m}`).join("; ")}`
          : undefined,
        duration: omitidos.length ? 10_000 : undefined,
      });
      setOpen(false);
      setNombre("");
      onCreado();
      router.push(`/lotes/${r.loteId}`);
    });
  }

  return (
    <>
      <Button size="sm" disabled={!ids.length} onClick={() => setOpen(true)}>
        <PhoneIcon data-icon="inline-start" />
        Llamar a seleccionados ({ids.length})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Llamar a {ids.length} {ids.length === 1 ? "contacto" : "contactos"}
            </DialogTitle>
            <DialogDescription>
              Se crea un lote que llama respetando el horario, el límite de llamadas simultáneas y los reintentos de
              Configuración. Se omiten quienes no se pueden llamar (sin consentimiento, con cita, en otro lote…).
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              crear();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre-lote">Nombre del lote (opcional)</Label>
              <Input
                id="nombre-lote"
                value={nombre}
                maxLength={120}
                placeholder="p. ej. Leads de octubre"
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creando…" : "Crear lote y empezar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useCallback, useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { crearContacto } from "@/app/(panel)/contactos/actions";
import { ContactoForm } from "./contacto-form";

export function NuevoContacto() {
  const [open, setOpen] = useState(false);
  const cerrar = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <PlusIcon data-icon="inline-start" />
        Nuevo contacto
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo contacto</DialogTitle>
        </DialogHeader>
        {open && <ContactoForm action={crearContacto} textoBoton="Crear contacto" onGuardado={cerrar} />}
      </DialogContent>
    </Dialog>
  );
}

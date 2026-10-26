"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/app/(panel)/app/contactos/actions";

export type ContactoValores = {
  nombre: string;
  telefono: string;
  email: string | null;
  consentimiento: boolean;
  consentimiento_fecha: string | null;
  consentimiento_origen: string | null;
  notas: string | null;
};

/** ISO → 'dd/mm/aaaa' en hora de Madrid. */
function fechaCorta(iso: string | null) {
  return iso
    ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso))
    : "";
}

export function ContactoForm({
  action,
  valores,
  textoBoton,
  onGuardado,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  valores?: ContactoValores;
  textoBoton: string;
  onGuardado?: (state: FormState) => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [consentimiento, setConsentimiento] = useState(valores?.consentimiento ?? false);

  useEffect(() => {
    if (state.ok) {
      toast.success("Guardado");
      onGuardado?.(state);
    }
  }, [state, onGuardado]);

  return (
    <form
      // Envío manual: con action={…} React vacía el formulario tras cada envío,
      // también cuando hay error, y el usuario perdería lo escrito.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nombre">Nombre *</Label>
          <Input id="nombre" name="nombre" required defaultValue={valores?.nombre} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="telefono">Teléfono *</Label>
          <Input id="telefono" name="telefono" required inputMode="tel" placeholder="600 11 22 33" defaultValue={valores?.telefono} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={valores?.email ?? ""} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Base legal para llamar</legend>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            name="consentimiento"
            checked={consentimiento}
            onCheckedChange={(checked) => setConsentimiento(checked)}
          />
          Tiene consentimiento para ser llamado
        </label>
        {consentimiento && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="consentimiento_fecha">Fecha (dd/mm/aaaa)</Label>
              <Input
                id="consentimiento_fecha"
                name="consentimiento_fecha"
                placeholder="Hoy, si se deja vacío"
                defaultValue={fechaCorta(valores?.consentimiento_fecha ?? null)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="consentimiento_origen">Origen</Label>
              <Input
                id="consentimiento_origen"
                name="consentimiento_origen"
                placeholder="Formulario web, contrato…"
                defaultValue={valores?.consentimiento_origen ?? ""}
              />
            </div>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" name="notas" rows={3} defaultValue={valores?.notas ?? ""} />
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending} className="self-end">
        {pending ? "Guardando…" : textoBoton}
      </Button>
    </form>
  );
}

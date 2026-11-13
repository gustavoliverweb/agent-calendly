"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopiarEnlace } from "@/components/equipo/equipo";
import { crearEmpresa, type CrearEmpresaState } from "@/app/(admin)/admin/actions";
import { slugDesdeNombre } from "@/lib/slug";

export function NuevaEmpresa() {
  const [open, setOpen] = useState(false);
  const [creada, setCreada] = useState<Extract<CrearEmpresaState, { empresaId: string }> | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCreada(null);
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Nueva empresa
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{creada ? "Empresa creada" : "Nueva empresa"}</DialogTitle>
          {!creada && (
            <DialogDescription>Se crea con la configuración por defecto y se invita a su propietario.</DialogDescription>
          )}
        </DialogHeader>
        {open && !creada && <Formulario onCreada={setCreada} />}
        {creada && <Resultado creada={creada} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ onCreada }: { onCreada: (r: Extract<CrearEmpresaState, { empresaId: string }>) => void }) {
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await crearEmpresa(nombre, slug, email);
          if ("error" in r) setError(r.error);
          else onCreada(r);
        });
      }}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="empresa-nombre">Nombre</Label>
        <Input
          id="empresa-nombre"
          required
          autoFocus
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            if (!slugEditado) setSlug(slugDesdeNombre(e.target.value));
          }}
          placeholder="Clínica Sonrisa"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="empresa-slug">Identificador</Label>
        <Input
          id="empresa-slug"
          required
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEditado(true);
          }}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">Será su subdominio por defecto. No se puede cambiar después.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="empresa-email">Email del propietario</Label>
        <Input
          id="empresa-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="gerencia@clinicasonrisa.com"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear empresa"}
      </Button>
    </form>
  );
}

function Resultado({ creada }: { creada: Extract<CrearEmpresaState, { empresaId: string }> }) {
  const { invitacion } = creada;
  return (
    <div className="flex flex-col gap-4 text-sm">
      {"error" in invitacion ? (
        <Alert variant="destructive">
          <AlertDescription>
            La empresa está creada, pero la invitación falló: {invitacion.error} Invita al propietario desde su ficha.
          </AlertDescription>
        </Alert>
      ) : invitacion.tipo === "enlace" ? (
        <>
          <p>
            Envía este enlace al propietario: con él elegirá su contraseña y entrará al panel. Es personal y caduca; si
            no lo usa a tiempo, genera otro desde la ficha de la empresa.
          </p>
          <CopiarEnlace url={invitacion.enlace} />
        </>
      ) : (
        <p>
          {invitacion.tipo === "email"
            ? "Se ha enviado la invitación por correo al propietario."
            : "El propietario ya tenía cuenta: puede entrar con su contraseña y verá la empresa nueva."}
        </p>
      )}
      <Link href={`/admin/empresas/${creada.empresaId}`} className={buttonVariants({ variant: "outline" })}>
        Ver la empresa
      </Link>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cambiarB2b } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Ficha de empresa en /admin: permitir campañas a empresas (B2B). */
export function ModoB2b({ empresaId, habilitado, enUso }: { empresaId: string; habilitado: boolean; enUso: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Llamadas a empresas (B2B)</CardTitle>
        <CardDescription>
          Permite a la empresa elegir el tipo de campaña B2B: sin consentimiento previo (interés legítimo), con la empresa
          del contacto y el origen de sus datos obligatorios. Actívalo solo cuando el asesor haya revisado su caso (también
          si va a llamar a autónomos, que son personas físicas).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          {habilitado ? "Habilitado" : "No habilitado"}
          {enUso && " · la empresa tiene la campaña en B2B"}
        </span>
        <Button
          size="sm"
          variant={habilitado ? "outline" : "default"}
          disabled={pending}
          onClick={() => {
            if (habilitado && enUso && !window.confirm("La empresa está en B2B: pasará a campaña comercial (exige consentimiento). ¿Seguir?")) return;
            startTransition(async () => {
              const r = await cambiarB2b(empresaId, !habilitado);
              if (r.error) toast.error(r.error);
              else toast.success(habilitado ? "B2B deshabilitado" : "B2B habilitado");
            });
          }}
        >
          {habilitado ? "Deshabilitar" : "Habilitar"}
        </Button>
      </CardContent>
    </Card>
  );
}

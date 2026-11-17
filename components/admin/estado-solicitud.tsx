"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cambiarEstadoSolicitud } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";

type Estado = "nueva" | "atendida" | "descartada";

/** Botones para marcar una solicitud de la web como atendida, descartada o nueva. */
export function EstadoSolicitud({ id, estado }: { id: string; estado: string }) {
  const [pending, startTransition] = useTransition();
  const cambiar = (nuevo: Estado) =>
    startTransition(async () => {
      const r = await cambiarEstadoSolicitud(id, nuevo);
      if (r.error) toast.error(r.error);
    });
  return (
    <div className="flex flex-wrap gap-1">
      {estado !== "atendida" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => cambiar("atendida")}>
          Atendida
        </Button>
      )}
      {estado !== "descartada" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => cambiar("descartada")}>
          Descartar
        </Button>
      )}
      {estado !== "nueva" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => cambiar("nueva")}>
          Reabrir
        </Button>
      )}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhoneIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { llamarContacto } from "@/app/(panel)/llamadas/actions";

export function BotonLlamar({ contactoId, motivoBloqueo }: { contactoId: string; motivoBloqueo?: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      disabled={pending || Boolean(motivoBloqueo)}
      title={motivoBloqueo}
      onClick={() =>
        startTransition(async () => {
          const r = await llamarContacto(contactoId);
          if (r.ok && r.llamadaId) {
            toast.success("Llamada iniciada");
            router.push(`/llamadas/${r.llamadaId}`);
          } else {
            toast.error(r.error ?? "No se ha podido lanzar la llamada");
          }
        })
      }
    >
      <PhoneIcon data-icon="inline-start" />
      {pending ? "Llamando…" : "Llamar"}
    </Button>
  );
}

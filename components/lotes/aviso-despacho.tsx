import { ClockIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Por qué los lotes activos no están llamando ahora mismo. */
export function AvisoDespacho({ texto }: { texto: string }) {
  return (
    <Alert>
      <ClockIcon />
      <AlertDescription>{texto}</AlertDescription>
    </Alert>
  );
}

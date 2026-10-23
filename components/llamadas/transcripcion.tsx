import { WrenchIcon } from "lucide-react";
import type { Turno } from "@/lib/calls/queries";
import { formatearDuracion } from "@/lib/calls/estados";
import { cn } from "@/lib/utils";

const TOOLS: Record<string, string> = {
  disponibilidad: "Consultó la agenda",
  agendar: "Reservó la cita",
  no_llamar: "Marcó “no llamar”",
  end_call: "Colgó",
  voicemail_detection: "Detectó buzón de voz",
};

export function Transcripcion({ turnos }: { turnos: Turno[] }) {
  if (!turnos.length) return <p className="text-sm text-muted-foreground">Sin transcripción.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {turnos.map((t, i) => {
        const agente = t.role === "agent";
        return (
          <li key={i} className={cn("flex flex-col gap-1", agente ? "items-start" : "items-end")}>
            {t.message && (
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  agente ? "rounded-tl-sm bg-muted" : "rounded-tr-sm bg-primary text-primary-foreground",
                )}
              >
                {t.message}
              </div>
            )}
            {t.tools?.map((tool, j) => (
              <span key={j} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <WrenchIcon className="size-3" />
                {TOOLS[tool] ?? tool}
                {t.tool_error && " (con error)"}
              </span>
            ))}
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {agente ? "Agente" : "Contacto"} · {formatearDuracion(t.time_in_call_secs)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

import { cn } from "@/lib/utils";

const LLAMADAS = [
  { nombre: "Laura G.", estado: "Cita agendada", detalle: "Jueves 11:30", activo: false, fuerte: true },
  { nombre: "Javier M.", estado: "En curso", detalle: "Hace 40 s", activo: true, fuerte: false },
  { nombre: "Pedro S.", estado: "Pide rellamada", detalle: "El lunes por la tarde", activo: false, fuerte: false },
  { nombre: "Marta R.", estado: "No llamar", detalle: "Registrado", activo: false, fuerte: false },
  { nombre: "Óscar L.", estado: "Sin respuesta", detalle: "Reintento mañana 10:00", activo: false, fuerte: false },
];

/** Maqueta estática del panel (no son datos reales). */
export function PanelDemo() {
  return (
    <div
      aria-label="Vista de ejemplo del panel"
      role="img"
      className="overflow-hidden rounded-2xl border border-carbon/15 bg-white"
    >
      <div className="flex items-center gap-1.5 border-b border-carbon/10 px-5 py-3">
        <span className="size-2.5 rounded-full bg-carbon/10" />
        <span className="size-2.5 rounded-full bg-carbon/10" />
        <span className="size-2.5 rounded-full bg-carbon/10" />
        <span className="ml-3 text-[13px] text-ceniza">Resumen de hoy</span>
      </div>
      <div className="grid grid-cols-3 border-b border-carbon/10">
        {[
          ["Llamadas", "128"],
          ["Contestadas", "74"],
          ["Citas", "21"],
        ].map(([k, v]) => (
          <div key={k} className="border-r border-carbon/10 px-5 py-4 last:border-r-0">
            <p className="text-[13px] text-ceniza">{k}</p>
            <p className="mt-0.5 text-[31px] font-semibold tracking-[-0.03em] text-carbon tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className="px-5 pt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-carbon">Leads de octubre</p>
          <p className="text-[13px] text-ceniza tabular-nums">412 de 600</p>
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-carbon/5">
          <div className="w-[52%] bg-marca-600" />
          <div className="w-[9%] bg-carbon/50" />
          <div className="w-[8%] bg-carbon/20" />
        </div>
      </div>
      <ul className="mt-3 divide-y divide-carbon/10">
        {LLAMADAS.map((l) => (
          <li key={l.nombre} className="flex items-center gap-3 px-5 py-3">
            <span className={cn("size-1.5 rounded-full", l.activo ? "bg-marca-600" : "bg-carbon/20")} />
            <span className="w-20 text-sm font-medium text-carbon">{l.nombre}</span>
            <span className={cn("text-sm", l.fuerte ? "font-medium text-marca-700" : "text-ceniza")}>{l.estado}</span>
            <span className="ml-auto text-right text-[13px] text-ceniza">{l.detalle}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

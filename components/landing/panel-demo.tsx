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
      className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_40px_80px_-40px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-center gap-1.5 border-b border-neutral-100 px-5 py-3">
        <span className="size-2.5 rounded-full bg-neutral-200" />
        <span className="size-2.5 rounded-full bg-neutral-200" />
        <span className="size-2.5 rounded-full bg-neutral-200" />
        <span className="ml-3 font-mono text-[10px] tracking-[0.18em] text-neutral-400 uppercase">Resumen · hoy</span>
      </div>
      <div className="grid grid-cols-3 border-b border-neutral-100">
        {[
          ["Llamadas", "128"],
          ["Contestadas", "74"],
          ["Citas", "21"],
        ].map(([k, v]) => (
          <div key={k} className="border-r border-neutral-100 px-5 py-4 last:border-r-0">
            <p className="font-mono text-[10px] tracking-[0.18em] text-neutral-400 uppercase">{k}</p>
            <p className="mt-1 text-3xl tracking-[-0.04em] text-neutral-950 tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className="px-5 pt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-neutral-950">Leads de octubre</p>
          <p className="font-mono text-[10px] tracking-[0.18em] text-neutral-400 uppercase">412 / 600</p>
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div className="w-[52%] bg-neutral-950" />
          <div className="w-[9%] bg-neutral-500" />
          <div className="w-[8%] bg-neutral-300" />
        </div>
      </div>
      <ul className="mt-3 divide-y divide-neutral-100">
        {LLAMADAS.map((l) => (
          <li key={l.nombre} className="flex items-center gap-3 px-5 py-3">
            <span className={cn("size-1.5 rounded-full", l.activo ? "animate-pulse bg-neutral-950" : "bg-neutral-300")} />
            <span className="text-sm text-neutral-950">{l.nombre}</span>
            <span className={cn("text-sm", l.fuerte ? "text-neutral-950" : "text-neutral-500")}>· {l.estado}</span>
            <span className="ml-auto font-mono text-[10px] tracking-[0.14em] text-neutral-400 uppercase">{l.detalle}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

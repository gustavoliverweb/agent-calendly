"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RotateCcwIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Turno =
  | { quien: "agente" | "cliente"; texto: string }
  | { quien: "tool"; texto: string; tipo?: "ok" | "aviso" };

type Caso = { id: string; etiqueta: string; contexto: string; resultado: string; turnos: Turno[] };

const CASOS: Caso[] = [
  {
    id: "clinica",
    etiqueta: "Clínica",
    contexto: "Clínica dental · lead de formulario web",
    resultado: "Cita agendada · jueves 11:30",
    turnos: [
      { quien: "agente", texto: "Hola, ¿hablo con Laura? Soy Clara, la asistente virtual de Clínica Sonrisa. Te llamo porque pediste información sobre la limpieza dental." },
      { quien: "cliente", texto: "Sí, soy yo. Dime." },
      { quien: "agente", texto: "¿Te vendría bien venir esta semana?" },
      { quien: "cliente", texto: "Mejor el jueves por la mañana." },
      { quien: "tool", texto: "disponibilidad · jueves → 3 huecos" },
      { quien: "agente", texto: "El jueves tengo a las 10:00, a las 11:30 o a las 12:15. ¿Cuál prefieres?" },
      { quien: "cliente", texto: "A las 11:30." },
      { quien: "tool", texto: "agendar · jueves 23, 11:30", tipo: "ok" },
      { quien: "agente", texto: "Listo: jueves 23 a las 11:30. Ahora te llega la confirmación al correo, con un enlace por si necesitas cambiarla." },
    ],
  },
  {
    id: "inmobiliaria",
    etiqueta: "Inmobiliaria",
    contexto: "Inmobiliaria · valoración de vivienda",
    resultado: "Cita agendada · miércoles 18:30",
    turnos: [
      { quien: "agente", texto: "Hola, Javier, soy Leo, el asistente virtual de Inmobiliaria Norte. Pediste una valoración de tu piso: ¿te cuadra que un agente pase a verlo?" },
      { quien: "cliente", texto: "Sí, pero solo puedo por las tardes." },
      { quien: "tool", texto: "disponibilidad · tardes → 3 huecos" },
      { quien: "agente", texto: "Tengo el martes a las 17:00, el miércoles a las 18:30 o el viernes a las 16:00." },
      { quien: "cliente", texto: "El martes a las cinco." },
      { quien: "tool", texto: "agendar · martes 17:00 → ya no está libre", tipo: "aviso" },
      { quien: "agente", texto: "Vaya, ese hueco se acaba de ocupar. ¿Te viene bien el miércoles a las 18:30?" },
      { quien: "cliente", texto: "Vale, el miércoles." },
      { quien: "tool", texto: "agendar · miércoles 18:30", tipo: "ok" },
      { quien: "agente", texto: "Hecho, miércoles a las 18:30. Te llegará la confirmación por correo." },
    ],
  },
  {
    id: "academia",
    etiqueta: "Academia",
    contexto: "Academia de idiomas · curso intensivo",
    resultado: "No llamar · registrado al instante",
    turnos: [
      { quien: "agente", texto: "Hola, ¿Marta? Soy Ana, la asistente virtual de Idiomas Centro. Te llamo por el curso intensivo de inglés que consultaste." },
      { quien: "cliente", texto: "Ya me apunté en otro sitio. Y prefiero que no me llaméis más." },
      { quien: "tool", texto: "no_llamar · lista de exclusión", tipo: "ok" },
      { quien: "agente", texto: "Entendido, Marta. No volveremos a llamarte. ¡Que te vaya muy bien con el curso!" },
    ],
  },
];

const PAUSA_MS = 1300;

const CONSULTA_REDUCIDO = "(prefers-reduced-motion: reduce)";
function suscribirReducido(cb: () => void) {
  const mq = window.matchMedia(CONSULTA_REDUCIDO);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Transcripción de ejemplo que se revela turno a turno al entrar en pantalla. */
export function LlamadaDemo() {
  const [caso, setCaso] = useState(CASOS[0]);
  const [mostrados, setMostrados] = useState(0);
  const [enPantalla, setEnPantalla] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Sin animación: la conversación entera desde el principio.
  const reducido = useSyncExternalStore(
    suscribirReducido,
    () => window.matchMedia(CONSULTA_REDUCIDO).matches,
    () => false,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setEnPantalla(true), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!enPantalla || reducido || mostrados >= caso.turnos.length) return;
    const id = setTimeout(() => setMostrados((n) => n + 1), mostrados === 0 ? 300 : PAUSA_MS);
    return () => clearTimeout(id);
  }, [enPantalla, reducido, mostrados, caso]);

  const visibles = reducido ? caso.turnos.length : mostrados;

  function elegir(c: Caso) {
    setCaso(c);
    setMostrados(0);
  }

  const terminado = visibles >= caso.turnos.length;

  return (
    <div ref={ref} className="flex flex-col gap-6">
      <div role="tablist" aria-label="Ejemplos de llamada" className="flex flex-wrap gap-2">
        {CASOS.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === caso.id}
            onClick={() => elegir(c)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm transition-colors",
              c.id === caso.id
                ? "border-white bg-white text-neutral-950"
                : "border-white/20 text-white/70 hover:border-white/50 hover:text-white",
            )}
          >
            {c.etiqueta}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 font-mono text-[11px] tracking-[0.18em] text-white/50 uppercase">
          <span className="flex items-center gap-2">
            <span className={cn("size-1.5 rounded-full bg-white", !terminado && "animate-pulse")} aria-hidden />
            {caso.contexto}
          </span>
          <span className="hidden sm:inline">{terminado ? "Llamada finalizada" : "En curso"}</span>
        </div>

        <ol className="mt-5 flex min-h-[26rem] flex-col gap-3" aria-live="polite">
          {caso.turnos.slice(0, visibles).map((t, i) =>
            t.quien === "tool" ? (
              <li
                key={`${caso.id}-${i}`}
                className="animate-in fade-in slide-in-from-bottom-1 self-center font-mono text-[11px] tracking-wide text-white/55 duration-500"
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1",
                    t.tipo === "ok" ? "border-white/40 text-white" : "border-white/15",
                    t.tipo === "aviso" && "border-dashed",
                  )}
                >
                  {t.tipo === "ok" ? "✓" : t.tipo === "aviso" ? "!" : "→"} {t.texto}
                </span>
              </li>
            ) : (
              <li
                key={`${caso.id}-${i}`}
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-2 max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed duration-500",
                  t.quien === "agente"
                    ? "self-start rounded-bl-md bg-white text-neutral-950"
                    : "self-end rounded-br-md bg-white/10 text-white",
                )}
              >
                <span className="sr-only">{t.quien === "agente" ? "Agente: " : "Cliente: "}</span>
                {t.texto}
              </li>
            ),
          )}
        </ol>

        <div className="mt-5 flex min-h-9 items-center justify-between gap-4 border-t border-white/10 pt-4">
          <span
            className={cn(
              "font-mono text-[11px] tracking-[0.18em] text-white uppercase transition-opacity duration-500",
              terminado ? "opacity-100" : "opacity-0",
            )}
          >
            {caso.resultado}
          </span>
          {terminado && (
            <button
              onClick={() => setMostrados(0)}
              className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
            >
              <RotateCcwIcon className="size-3.5" /> Repetir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

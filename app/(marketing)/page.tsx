import Link from "next/link";
import { ArrowRightIcon, ArrowUpRightIcon, PlusIcon } from "lucide-react";
import { LlamadaDemo } from "@/components/landing/llamada-demo";
import { OndaPuntos } from "@/components/landing/onda-puntos";
import { PanelDemo } from "@/components/landing/panel-demo";
import { enlaceDemo, MARCA } from "@/lib/marca";
import { cn } from "@/lib/utils";

const titular = "font-normal tracking-[-0.045em] text-balance";
const etiqueta = "font-mono text-[11px] tracking-[0.22em] uppercase";
const botonNegro =
  "inline-flex h-12 items-center gap-2 rounded-full bg-neutral-950 px-6 text-[15px] text-white transition-colors hover:bg-neutral-800";
const botonBorde =
  "inline-flex h-12 items-center gap-2 rounded-full border border-neutral-300 bg-white px-6 text-[15px] text-neutral-950 transition-colors hover:border-neutral-950";

const PASOS = [
  {
    clave: "Importa",
    titulo: "Sube tu lista de leads.",
    texto: "Un CSV exportado de Excel o de tu CRM. Valida cada teléfono, detecta duplicados y guarda el consentimiento de cada contacto.",
  },
  {
    clave: "Llama",
    titulo: "Llama en tu horario, no en el suyo.",
    texto: "Por lotes, con las llamadas simultáneas que elijas, solo dentro de tus franjas y nunca en festivos.",
  },
  {
    clave: "Conversa",
    titulo: "Se presenta como asistente virtual.",
    texto: "Saluda por el nombre, escucha, resuelve dudas y se adapta a quien contesta. Sin guiones rígidos.",
  },
  {
    clave: "Agenda",
    titulo: "Ofrece huecos reales de tu Calendly.",
    texto: "Consulta tu agenda durante la llamada y reserva en el momento. Si un hueco se ocupa mientras habla, ofrece otro.",
  },
  {
    clave: "Registra",
    titulo: "Todo queda en tu panel.",
    texto: "Transcripción, resumen y resultado de cada llamada. Si no contestan, reintenta otro día, a otra hora.",
  },
];

const FUNCIONES = [
  ["Lotes con reintentos", "Selecciona contactos y deja que avance la cola. Si no contestan, vuelve a intentarlo cuando toca."],
  ["Franjas y festivos", "Decide cuándo se llama. Fuera de horario, el sistema espera solo."],
  ["Cada llamada, transcrita", "Lee qué se dijo, qué resolvió el agente y qué cita se reservó."],
  ["Pausa global", "Un botón detiene al instante cualquier llamada nueva."],
];

const GARANTIAS = [
  ["3", "huecos reales en cada propuesta"],
  ["0", "llamadas fuera de tu horario"],
  ["100 %", "de llamadas transcritas y clasificadas"],
  ["1 clic", "para pausarlo todo"],
];

const RGPD = [
  ["Lista de exclusión permanente", "Si alguien pide no ser llamado, queda excluido al momento y para siempre, también de los lotes en marcha."],
  ["Consentimiento registrado", "En campañas comerciales solo se llama a quien tiene consentimiento, con fecha y origen guardados."],
  ["Transparencia", "El agente se presenta siempre como asistente virtual desde la primera frase."],
  ["Datos en la UE", "La base de datos está alojada en Frankfurt. No se guarda el audio de las llamadas."],
  ["Derecho de supresión", "Un borrado elimina el contacto, sus llamadas y sus transcripciones, también en el proveedor de voz."],
  ["Retención configurable", "Las conversaciones antiguas se borran solas pasado el plazo que tú decidas."],
];

const PREGUNTAS = [
  [
    "¿Qué necesito para empezar?",
    "Una cuenta de Calendly de pago (su API de reservas lo requiere), una cuenta de ElevenLabs y un número de teléfono con línea SIP para las llamadas salientes. Nosotros configuramos el resto.",
  ],
  [
    "¿La persona sabe que habla con una IA?",
    "Sí. El agente se presenta como asistente virtual al empezar la llamada. Es una decisión de diseño y una buena práctica legal.",
  ],
  [
    "¿Qué pasa si no contestan?",
    "La llamada se reprograma automáticamente según tus reglas (por defecto, dos reintentos separados 24 horas y siempre dentro de tu horario). Agotados los intentos, el contacto queda como “no contesta”.",
  ],
  [
    "¿Y si el hueco se ocupa durante la llamada?",
    "El agente lo detecta al reservar y ofrece otra opción sin colgar. La agenda que consulta es la de tu Calendly en ese momento.",
  ],
  [
    "¿Cuánto cuesta cada llamada?",
    "Depende del proveedor de voz y del operador. Como referencia, una llamada de tres minutos ronda los 0,30–0,40 $ en consumo. El panel muestra una estimación diaria.",
  ],
  [
    "¿Puedo pararlo en cualquier momento?",
    "Sí. Puedes pausar o cancelar cada lote, o activar la pausa global para detener cualquier llamada nueva al instante.",
  ],
];

export default function Landing() {
  return (
    <main className="bg-white text-neutral-950">
      {/* Hero */}
      <section className="relative -mt-[4.5rem] overflow-hidden px-6 pt-36 pb-20 sm:pt-44 lg:pb-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className={cn(etiqueta, "text-neutral-500")}>Agente de voz con IA · Llamadas salientes</p>
            <h1 className={cn(titular, "mt-6 text-[clamp(2.75rem,6.4vw,5.75rem)] leading-[0.95]")}>
              Tus leads, llamados en minutos. <span className="text-neutral-400">Sus citas, en tu agenda.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-neutral-600">
              {MARCA.nombre} llama a cada contacto, conversa como una persona, consulta tu Calendly en directo y reserva
              la cita sin que nadie de tu equipo descuelgue el teléfono.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href={enlaceDemo} className={botonNegro}>
                Solicitar una demo <ArrowRightIcon className="size-4" />
              </a>
              <a href="#como-funciona" className={botonBorde}>
                Ver cómo funciona
              </a>
            </div>
            <p className={cn(etiqueta, "mt-10 text-neutral-400")}>Con Calendly y ElevenLabs · Pensado para el RGPD</p>
          </div>
          <div className="relative h-[clamp(16rem,38vw,30rem)]">
            <OndaPuntos columnas={54} puntosPorColumna={70} />
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="scroll-mt-24 border-t border-neutral-100 px-6 py-24 lg:py-36">
        <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[1fr_1.4fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className={cn(etiqueta, "text-neutral-500")}>Cómo funciona</p>
            <h2 className={cn(titular, "mt-5 text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]")}>
              Cinco pasos. <span className="text-neutral-400">Ninguno lo das tú.</span>
            </h2>
            <p className="mt-6 max-w-sm leading-relaxed text-neutral-600">
              Subes la lista y eliges cuándo llamar. Lo demás ocurre solo, y lo ves en directo.
            </p>
          </div>
          <ol className="flex flex-col">
            {PASOS.map((p, i) => (
              <li key={p.clave} className="aparecer grid grid-cols-[4.5rem_1fr] gap-4 border-t border-neutral-200 py-10 sm:grid-cols-[7rem_1fr]">
                <span className="text-5xl tracking-[-0.05em] text-neutral-300 tabular-nums sm:text-6xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className={cn(etiqueta, "flex items-center gap-3 text-neutral-500")}>
                    <span className="h-px w-8 bg-neutral-300" /> {p.clave}
                  </p>
                  <h3 className="mt-3 text-2xl tracking-[-0.03em] sm:text-3xl">{p.titulo}</h3>
                  <p className="mt-3 max-w-lg leading-relaxed text-neutral-600">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Una llamada */}
      <section id="llamada" data-tema="oscuro" className="scroll-mt-24 bg-neutral-950 px-6 py-24 text-white lg:py-36">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <p className={cn(etiqueta, "text-white/45")}>Una llamada de ejemplo</p>
            <h2 className={cn(titular, "mt-5 text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]")}>
              Así suena <br className="hidden sm:block" />
              <span className="text-white/45">una cita agendada.</span>
            </h2>
            <p className="mt-6 max-w-md leading-relaxed text-white/60">
              Mientras conversa, el agente consulta tu agenda y reserva. Las líneas en gris son lo que hace por debajo:
              exactamente lo que verás después en la transcripción del panel.
            </p>
            <div className="mt-12 hidden h-40 opacity-80 lg:block">
              <OndaPuntos color="255, 255, 255" columnas={36} puntosPorColumna={24} />
            </div>
          </div>
          <LlamadaDemo />
        </div>
      </section>

      {/* El panel */}
      <section id="panel" className="scroll-mt-24 px-6 py-24 lg:py-36">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className={cn(etiqueta, "text-neutral-500")}>El panel</p>
            <h2 className={cn(titular, "mt-5 text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]")}>
              Lo ves todo. <span className="text-neutral-400">Lo controlas todo.</span>
            </h2>
          </div>
          <div className="mt-16 grid items-start gap-14 lg:grid-cols-[1.3fr_1fr]">
            <div className="aparecer">
              <PanelDemo />
            </div>
            <ul className="flex flex-col">
              {FUNCIONES.map(([t, d]) => (
                <li key={t} className="aparecer border-t border-neutral-200 py-6 first:border-t-0 first:pt-0">
                  <h3 className="text-xl tracking-[-0.02em]">{t}</h3>
                  <p className="mt-2 leading-relaxed text-neutral-600">{d}</p>
                </li>
              ))}
              <li className="pt-4">
                <Link href="/login" className={botonBorde}>
                  Acceder al panel <ArrowUpRightIcon className="size-4" />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Garantías */}
      <section aria-label="En cifras" className="border-t border-neutral-100 px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <p className={cn(etiqueta, "text-neutral-500")}>Por diseño</p>
          <dl className="mt-12 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {GARANTIAS.map(([n, t]) => (
              <div key={t} className="aparecer border-t border-neutral-950 pt-6">
                <dt className="text-[clamp(3.5rem,7vw,6rem)] leading-none tracking-[-0.06em] tabular-nums">{n}</dt>
                <dd className="mt-4 max-w-[14rem] text-neutral-600">{t}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Seguridad y RGPD */}
      <section id="seguridad" data-tema="oscuro" className="scroll-mt-24 bg-neutral-950 px-6 py-24 text-white lg:py-36">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className={cn(etiqueta, "text-white/45")}>Seguridad y RGPD</p>
            <h2 className={cn(titular, "mt-5 text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]")}>
              Llama a quien quiere. <span className="text-white/45">Respeta a quien no.</span>
            </h2>
          </div>
          <ul className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {RGPD.map(([t, d], i) => (
              <li key={t} className="bg-neutral-950 p-7 sm:p-8">
                <p className={cn(etiqueta, "text-white/35")}>{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-6 text-xl tracking-[-0.02em]">{t}</h3>
                <p className="mt-3 leading-relaxed text-white/55">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Preguntas */}
      <section id="preguntas" className="scroll-mt-24 px-6 py-24 lg:py-36">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <p className={cn(etiqueta, "text-neutral-500")}>Preguntas</p>
            <h2 className={cn(titular, "mt-5 text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]")}>Lo que quieres saber.</h2>
          </div>
          <div className="border-b border-neutral-200">
            {PREGUNTAS.map(([p, r]) => (
              <details key={p} className="group border-t border-neutral-200">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                  {p}
                  <PlusIcon className="size-5 shrink-0 text-neutral-400 transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <p className="max-w-2xl pb-7 leading-relaxed text-neutral-600">{r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Llamada a la acción */}
      <section data-tema="oscuro" className="relative overflow-hidden bg-neutral-950 px-6 pt-28 pb-24 text-white lg:pt-40">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-60">
          <OndaPuntos color="255, 255, 255" columnas={72} puntosPorColumna={20} />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <h2 className={cn(titular, "text-[clamp(2.5rem,6vw,5.25rem)] leading-[0.98]")}>
            Tus leads esperan una llamada. <span className="text-white/45">Que la reciban hoy.</span>
          </h2>
          <div className="mt-11 flex flex-wrap justify-center gap-3">
            <a href={enlaceDemo} className={cn(botonNegro, "bg-white text-neutral-950 hover:bg-neutral-200")}>
              Solicitar una demo <ArrowRightIcon className="size-4" />
            </a>
            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 px-6 text-[15px] text-white transition-colors hover:border-white"
            >
              Acceder al panel
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

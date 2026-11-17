import Link from "next/link";
import { CtaFinal, Lista, Pasos, Preguntas, Seccion } from "@/components/landing/bloques";
import { LlamadaDemo } from "@/components/landing/llamada-demo";
import { OndaPuntos } from "@/components/landing/onda-puntos";
import { PanelDemo } from "@/components/landing/panel-demo";
import { botonBorde, botonPrincipal, entradilla, titularPagina } from "@/components/landing/estilos";
import { enlaceDemo, MARCA } from "@/lib/marca";
import { cn } from "@/lib/utils";

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

const FUNCIONES: [string, string][] = [
  ["Lotes con reintentos", "Selecciona contactos y deja que avance la cola. Si no contestan, vuelve a intentarlo cuando toca."],
  ["Franjas y festivos", "Decide cuándo se llama. Fuera de horario, el sistema espera solo."],
  ["Cada llamada, transcrita", "Lee qué se dijo, qué resolvió el agente y qué cita se reservó."],
  ["Pausa global", "Un botón detiene al instante cualquier llamada nueva."],
];

const RGPD: [string, string][] = [
  ["Lista de exclusión permanente", "Si alguien pide no ser llamado, queda excluido al momento y para siempre, también de los lotes en marcha."],
  ["Consentimiento registrado", "En campañas comerciales solo se llama a quien tiene consentimiento, con fecha y origen guardados."],
  ["Transparencia", "El agente se presenta siempre como asistente virtual desde la primera frase."],
  ["Datos en la UE", "La base de datos está alojada en Frankfurt. No se guarda el audio de las llamadas."],
  ["Derecho de supresión", "Un borrado elimina el contacto, sus llamadas y sus transcripciones, también en el proveedor de voz."],
  ["Retención configurable", "Las conversaciones antiguas se borran solas pasado el plazo que tú decidas."],
];

const PREGUNTAS: [string, string][] = [
  [
    "¿Qué necesito para empezar?",
    "Una cuenta de Calendly de pago (su API de reservas lo requiere) y un número de teléfono con línea SIP de tu operador para las llamadas salientes. El agente de voz y el resto de la configuración los ponemos nosotros.",
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
    "Pagas por minuto de conversación, con un límite mensual que decides tú, y ves el consumo en el panel. Te preparamos un plan según tu volumen: mira cómo funciona en Precios.",
  ],
  [
    "¿Puedo pararlo en cualquier momento?",
    "Sí. Puedes pausar o cancelar cada lote, o activar la pausa global para detener cualquier llamada nueva al instante.",
  ],
];

export default function Landing() {
  return (
    <main className="bg-white">
      <section className="relative -mt-[4.5rem] overflow-hidden px-6 pt-36 pb-16 sm:pt-44 lg:pb-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <h1 className={cn(titularPagina, "text-[clamp(3rem,7.6vw,6rem)] leading-[0.92]")}>
              Tus leads, llamados en minutos. Sus citas, en tu agenda.
            </h1>
            <p className={cn(entradilla, "mt-8 max-w-xl")}>
              {MARCA.nombre} llama a cada contacto, conversa con tu guion, consulta tu Calendly en directo y reserva la cita
              sin que nadie de tu equipo descuelgue el teléfono.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href={enlaceDemo} className={botonPrincipal}>
                Solicitar una demo
              </Link>
              <a href="#llamada" className={botonBorde}>
                Escuchar una llamada
              </a>
            </div>
          </div>
          <div className="relative h-[clamp(14rem,36vw,30rem)]" aria-hidden>
            <OndaPuntos color="225, 29, 46" columnas={54} puntosPorColumna={70} />
          </div>
        </div>
      </section>

      <Seccion
        id="como-funciona"
        titulo="Cinco pasos. Ninguno lo das tú."
        texto={<p>Subes la lista y eliges cuándo llamar. Lo demás ocurre solo, y lo ves en directo.</p>}
      >
        <Pasos items={PASOS} />
      </Seccion>

      <Seccion
        id="llamada"
        oscuro
        titulo="Así suena una cita agendada."
        texto={
          <p>
            Mientras conversa, el agente consulta tu agenda y reserva. Las líneas pequeñas son lo que hace por debajo:
            exactamente lo que verás después en la transcripción del panel.
          </p>
        }
      >
        <LlamadaDemo />
      </Seccion>

      <Seccion id="panel" apilada titulo="Lo ves todo. Lo controlas todo.">
        <div className="grid items-start gap-14 lg:grid-cols-[1.3fr_1fr]">
          <PanelDemo />
          <div>
            <ul className="flex flex-col gap-8">
              {FUNCIONES.map(([t, d]) => (
                <li key={t}>
                  <h3 className="text-xl font-semibold tracking-[-0.015em]">{t}</h3>
                  <p className="mt-2 text-[17px] leading-relaxed text-ceniza">{d}</p>
                </li>
              ))}
            </ul>
            <Link href="/producto" className={cn(botonBorde, "mt-10")}>
              Ver todo lo que hace
            </Link>
          </div>
        </div>
      </Seccion>

      <Seccion id="seguridad" oscuro titulo="Llama a quien quiere. Respeta a quien no.">
        <Lista items={RGPD} oscuro />
        <Link href="/seguridad" className="mt-12 inline-block text-[17px] text-white underline underline-offset-4 hover:text-marca-200">
          Cómo cumplimos el RGPD
        </Link>
      </Seccion>

      <div id="preguntas" className="scroll-mt-24">
        <Preguntas items={PREGUNTAS} />
      </div>

      <CtaFinal
        titulo="Tus leads esperan una llamada."
        destacado="Que la reciban hoy, en tu horario y con tu guion."
        origen="/"
        secundaria={{ href: "/login", texto: "Acceder al panel" }}
      />
    </main>
  );
}

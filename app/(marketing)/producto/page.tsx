import type { Metadata } from "next";
import Link from "next/link";
import { CtaFinal, Dialogo, Hero, Lista, Pasos, Preguntas, Seccion } from "@/components/landing/bloques";
import { marcaPlataforma } from "@/lib/marca-plataforma";

export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaPlataforma();
  return {
    title: "Producto",
    description: `Qué hace ${marca.nombre}: un agente de voz con IA que llama a tus contactos, conversa con tu guion y reserva la cita en tu Calendly, con un panel para contactos, lotes, llamadas y uso.`,
    alternates: { canonical: "/producto" },
  };
}

/** Lo que hace el agente durante la llamada (las herramientas que usa). */
const EN_LLAMADA = [
  {
    clave: "Se presenta",
    titulo: "Dice quién es y que es una IA.",
    texto: "Saluda por el nombre, dice de qué negocio llama, que es una asistente virtual y que la llamada se transcribe. Sin eso, el panel no deja guardar el guion.",
  },
  {
    clave: "Conversa",
    titulo: "Responde con tu guion, no con lo que se imagina.",
    texto: "Explica tu oferta, resuelve las preguntas frecuentes y trata las objeciones que hayas previsto. Lo que no está en el guion, lo deja para la cita.",
  },
  {
    clave: "Consulta",
    titulo: "Mira tu agenda en directo.",
    texto: "Pide a tu Calendly los huecos libres de los días que le dicen y ofrece opciones reales.",
  },
  {
    clave: "Reserva",
    titulo: "Agenda sin colgar.",
    texto: "Reserva la cita con el nombre y el email del contacto. Si el hueco se acaba de ocupar, ofrece otro en la misma llamada.",
  },
  {
    clave: "Cierra",
    titulo: "Clasifica y deja el resumen.",
    texto: "Al colgar, la llamada queda transcrita, resumida y clasificada, y el contacto pasa al estado que toca: con cita, para seguimiento o excluido.",
  },
];

const MODULOS: { nombre: string; texto: string; puntos: string[] }[] = [
  {
    nombre: "Contactos",
    texto: "Tu lista, limpia y con su base legal.",
    puntos: [
      "Importación CSV de hasta 5.000 filas, con detección automática de columnas",
      "Teléfonos validados y duplicados detectados",
      "Consentimiento con fecha y origen",
      "Lista de exclusión permanente",
    ],
  },
  {
    nombre: "Guion",
    texto: "Lo que dice el agente, en tus palabras.",
    puntos: [
      "Apartados guiados: negocio, motivo, oferta, cita, preguntas, objeciones y límites",
      "Versiones guardadas y una activa",
      "Prueba en el navegador antes de llamar a nadie",
      "Primer mensaje revisado para que cumpla",
    ],
  },
  {
    nombre: "Lotes",
    texto: "Llamadas en cola, a tu ritmo.",
    puntos: [
      "Llamadas simultáneas que eliges",
      "Solo en tus franjas y nunca en festivos",
      "Reintentos con las horas de espera que decidas",
      "Pausa o cancelación por lote, y pausa global",
    ],
  },
  {
    nombre: "Llamadas",
    texto: "Qué pasó en cada una.",
    puntos: [
      "Transcripción completa y resumen",
      "Resultado: cita, rellamar, no interesado, no llamar…",
      "Datos recogidos durante la llamada",
      "Cita vinculada, con cambios y cancelaciones de Calendly",
    ],
  },
  {
    nombre: "Resumen",
    texto: "El día de un vistazo.",
    puntos: [
      "Llamadas, contestadas, citas y minutos de hoy y de la semana",
      "Llamadas en curso",
      "Contactos que esperan seguimiento",
      "Avisos si algo no está bien configurado",
    ],
  },
  {
    nombre: "Uso y equipo",
    texto: "Control del gasto y de quién entra.",
    puntos: [
      "Minutos e importe estimado de cada mes",
      "Límite mensual de minutos",
      "Exportación CSV del detalle",
      "Usuarios con rol de propietario u operador",
    ],
  },
];

const PARA_EQUIPOS: [string, string][] = [
  [
    "Campañas a empresas",
    "Modo B2B para llamar a otras empresas: el agente sabe tratar con recepción, pregunta por la persona que decide y anota a quién llamar si no está.",
  ],
  [
    "Marca blanca",
    "Tu dominio, tu logo y tus colores en el login, el panel y las páginas legales. Pensado para agencias que lo ofrecen a sus clientes.",
  ],
  [
    "Tu propia línea",
    "Las llamadas salen desde el número de tu empresa, a través de la línea SIP de tu operador.",
  ],
  [
    "Cada empresa, aislada",
    "Contactos, guiones y llamadas separados por empresa en la propia base de datos.",
  ],
];

const PREGUNTAS: [string, string][] = [
  [
    "¿Qué tengo que preparar yo?",
    "Tu guion (te ayudamos a escribirlo), tu lista de contactos, una cuenta de Calendly de pago y una línea de teléfono con tu operador. Lo explicamos con detalle en la guía «Qué necesitas para empezar».",
  ],
  [
    "¿Se guarda el audio de las llamadas?",
    "No. Se guardan la transcripción y el resumen, que se borran solos pasado el plazo que configures.",
  ],
  [
    "¿Puede llamar a números de fuera de España?",
    "Los teléfonos sin prefijo se interpretan como españoles. Los extranjeros se aceptan con su prefijo y la importación los señala para que los revises.",
  ],
  [
    "¿Puedo cambiar el guion a mitad de campaña?",
    "Sí. Guardas una versión nueva y la activas; las llamadas siguientes usan la nueva y cada llamada recuerda con qué versión se hizo.",
  ],
];

export default async function ProductoPage() {
  const marca = await marcaPlataforma();
  return (
    <main className="bg-white">
      <Hero
        titulo="Llama, conversa y agenda."
        destacado="Tú solo miras el panel."
        texto={
          <p>
            {marca.nombre} es un agente de voz con inteligencia artificial que llama a tus contactos, les habla con tu guion y
            reserva la cita en tu Calendly. Todo lo que pasa queda en un panel pensado para equipos pequeños.
          </p>
        }
        principal={{ href: "/contacto?origen=/producto", texto: "Solicitar una demo" }}
        secundaria={{ href: "#panel", texto: "Ver el panel" }}
      />

      <Seccion titulo="Lo que hace el agente, paso a paso.">
        <Pasos items={EN_LLAMADA} />
      </Seccion>

      <Seccion
        oscuro
        titulo="Escucha tu guion antes que tus clientes."
        texto={
          <p>
            Desde el panel hablas con el agente en el navegador, con tu guion y tu agenda reales. Ajustas lo que no te
            convenza y activas la versión buena.
          </p>
        }
      >
        <Dialogo
          titulo="Prueba en el navegador: una objeción"
          turnos={[
            { quien: "agente", texto: "…la primera visita es gratuita y dura unos treinta minutos. ¿Le busco un hueco esta semana?" },
            { quien: "contacto", texto: "Ahora no me viene bien, estoy muy liado." },
            { quien: "agente", texto: "Lo entiendo. ¿Prefiere que le llame otro día? Dígame cuándo le viene mejor y le llamo entonces." },
            { quien: "contacto", texto: "El lunes por la mañana." },
            { quien: "nota", texto: "Clasifica la llamada como «rellamar» y deja el contacto en seguimiento." },
          ]}
        />
      </Seccion>

      <Seccion id="panel" apilada titulo="Todo en un sitio, sin hojas de cálculo.">
        <ul className="grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => (
            <li key={m.nombre}>
              <h3 className="text-[25px] font-semibold tracking-[-0.02em]">{m.nombre}</h3>
              <p className="mt-1 text-[17px] text-carbon">{m.texto}</p>
              <ul className="mt-4 flex flex-col gap-2 text-[16px] leading-relaxed text-ceniza">
                {m.puntos.map((p) => (
                  <li key={p} className="flex gap-3">
                    <span className="mt-[0.7em] size-1 shrink-0 rounded-full bg-marca-600" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion oscuro titulo="Cuando necesitas más que un agente.">
        <Lista items={PARA_EQUIPOS} oscuro />
      </Seccion>

      <Seccion titulo="Cómo encaja con lo que ya usas.">
        <ul className="border-b border-carbon/10">
          {[
            { href: "/integraciones", titulo: "Integraciones", texto: "Calendly, tu línea de teléfono y tus listas de contactos." },
            { href: "/seguridad", titulo: "Seguridad y RGPD", texto: "Cómo cumple el agente en cada llamada y dónde están tus datos." },
            { href: "/calculadora", titulo: "Calculadora de retorno", texto: "Cuántas citas y minutos saldrían de tus leads." },
          ].map((l) => (
            <li key={l.href} className="border-t border-carbon/10">
              <Link href={l.href} className="group block py-6">
                <span className="text-[25px] font-semibold tracking-[-0.02em] underline decoration-marca-600/0 decoration-2 underline-offset-4 transition-colors group-hover:decoration-marca-600">
                  {l.titulo}
                </span>
                <span className="mt-1 block text-[17px] text-ceniza">{l.texto}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Seccion>

      <Preguntas items={PREGUNTAS} />

      <CtaFinal titulo="Míralo con tu guion." destacado="En una demo, sin compromiso." origen="/producto" />
    </main>
  );
}

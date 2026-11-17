import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { CtaFinal, Hero, Pasos, Preguntas, Seccion, Tarjetas } from "@/components/landing/bloques";
import { botonBorde, botonPrincipal, etiqueta } from "@/components/landing/estilos";
import { MARCA } from "@/lib/marca";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Precios",
  description: `Pagas por minuto de conversación, con un límite mensual que decides tú. Planes de ${MARCA.nombre} a medida de tu volumen de leads.`,
  alternates: { canonical: "/precios" },
};

/*
 * Sin cifras hasta que el cliente fije sus tarifas: cada plan dice «A medida».
 * Para publicar precios, cambia `precio` y `detallePrecio` de cada plan.
 */
const PLANES = [
  {
    nombre: "Para empezar",
    para: "Un negocio que quiere dejar de perder leads por no llamar a tiempo.",
    precio: "A medida",
    detallePrecio: "Pago por minuto de conversación",
    incluye: [
      "Agente de voz con tu guion",
      "Conexión con tu Calendly",
      "Panel con contactos, lotes y llamadas",
      "Transcripción y resumen de cada llamada",
      "Prueba del agente desde el navegador",
    ],
    destacado: false,
  },
  {
    nombre: "Para volumen",
    para: "Equipos con cientos de leads al mes o varias campañas a la vez.",
    precio: "A medida",
    detallePrecio: "Mejor precio por minuto según volumen",
    incluye: [
      "Todo lo de «Para empezar»",
      "Más llamadas simultáneas",
      "Varios usuarios con roles",
      "Exportación del uso mensual",
      "Campañas a empresas (B2B)",
    ],
    destacado: true,
  },
  {
    nombre: "Marca blanca",
    para: "Agencias y empresas que quieren ofrecer el servicio con su propia marca.",
    precio: "A medida",
    detallePrecio: "Por cuenta y minuto",
    incluye: [
      "Tu dominio, tu logo y tus colores",
      "Páginas legales con tus datos",
      "Una cuenta aislada por cliente",
      "Uso de cada cuenta para facturar",
      "Alta acompañada de cada cliente",
    ],
    destacado: false,
  },
];

const MODELO: [string, string][] = [
  [
    "Pagas por minuto de conversación",
    "Cuentan los minutos en los que el agente habla con alguien, también las pruebas desde el navegador. Si nadie contesta, no hay conversación que pagar.",
  ],
  [
    "Tú pones el límite",
    "Fijamos contigo un tope de minutos al mes. Al alcanzarlo, no sale ninguna llamada más hasta el mes siguiente: nunca te llevas una sorpresa en la factura.",
  ],
  [
    "Consumo a la vista",
    "En el panel ves cada mes los minutos, las llamadas, las contestadas y las citas, y puedes descargar el detalle en CSV.",
  ],
  [
    "Llamadas simultáneas contratadas",
    "Decides cuántas llamadas pueden estar en curso a la vez. Dentro de ese máximo, ajustas el ritmo desde la configuración.",
  ],
];

const ALTA = [
  { clave: "Hablamos", titulo: "Nos cuentas tu caso.", texto: "Volumen de leads, horario de llamadas y qué cita quieres conseguir. Con eso te proponemos un plan." },
  { clave: "Preparamos", titulo: "Guion, calendario y línea.", texto: "Escribes tu guion en el panel (te ayudamos), conectas tu Calendly con un clic y damos de alta tu línea telefónica." },
  { clave: "Pruebas", titulo: "Lo escuchas antes de llamar a nadie.", texto: "Pruebas el agente desde el navegador con tu guion y tus huecos reales, sin marcar ningún teléfono." },
  { clave: "Lanzas", titulo: "Importas tus leads y empieza a llamar.", texto: "Subes la lista, eliges el horario y el agente se pone a trabajar. Tú ves cada llamada en el panel." },
];

const NECESITAS: [string, string][] = [
  ["Una cuenta de Calendly de pago", "Su plan gratuito no permite reservar citas desde otra aplicación. Con el plan Standard es suficiente."],
  ["Una línea de teléfono (SIP)", "La contratas con tu operador, con el número desde el que quieres llamar. Nosotros la damos de alta."],
  ["Tu lista de contactos", "Un CSV exportado de Excel o de tu CRM. En campañas comerciales, con el consentimiento de cada contacto."],
];

const PREGUNTAS: [string, string][] = [
  [
    "¿Por qué no hay precios publicados?",
    "Porque el coste depende sobre todo de cuántos minutos vas a usar y de cuántas llamadas quieres a la vez. Preferimos darte una cifra cerrada para tu caso que una tabla que no se parezca a tu realidad.",
  ],
  [
    "¿Qué cuenta como minuto?",
    "El tiempo de conversación de cada llamada, sumado y redondeado a la décima de minuto. Las llamadas que nadie contesta apenas consumen, y las pruebas desde el navegador cuentan igual que una llamada.",
  ],
  [
    "¿Qué pasa si llego al límite del mes?",
    "Las llamadas se detienen hasta el mes siguiente y el panel te avisa. Si necesitas más, lo ampliamos.",
  ],
  [
    "¿Puedo pausar las llamadas?",
    "Sí, en cualquier momento: cada lote por separado o todas a la vez con la pausa global.",
  ],
  [
    "¿Cuánto tarda la puesta en marcha?",
    "Depende sobre todo de tu operador de telefonía. Mientras llega la línea puedes preparar el guion, conectar Calendly, importar contactos y probar el agente en el navegador.",
  ],
];

export default function PreciosPage() {
  return (
    <main className="bg-white text-neutral-950">
      <Hero
        etiqueta="Precios"
        titulo="Pagas por conversar."
        destacado="No por intentarlo."
        texto={
          <p>
            Un precio por minuto de conversación, un límite mensual que decides tú y el consumo siempre a la vista. Te
            preparamos un plan a la medida de tu volumen de leads.
          </p>
        }
        principal={{ href: "/contacto?origen=/precios", texto: "Pedir presupuesto" }}
        secundaria={{ href: "#planes", texto: "Ver planes" }}
      />

      <section id="planes" className="scroll-mt-24 px-6 pb-24 lg:pb-32">
        <ul className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
          {PLANES.map((p) => (
            <li
              key={p.nombre}
              className={cn(
                "flex flex-col rounded-3xl border p-7 sm:p-8",
                p.destacado ? "border-tinta-950 bg-tinta-950 text-white" : "border-neutral-200 bg-white",
              )}
            >
              <p className={cn(etiqueta, p.destacado ? "text-marca-400" : "text-marca-600")}>{p.nombre}</p>
              <p className={cn("mt-4 min-h-12 leading-relaxed", p.destacado ? "text-white/65" : "text-neutral-600")}>{p.para}</p>
              <p className="mt-8 text-4xl tracking-[-0.04em]">{p.precio}</p>
              <p className={cn("mt-2 text-sm", p.destacado ? "text-white/55" : "text-neutral-500")}>{p.detallePrecio}</p>
              <ul className="mt-8 flex flex-1 flex-col gap-3 text-[15px]">
                {p.incluye.map((i) => (
                  <li key={i} className="flex gap-3">
                    <CheckIcon className={cn("mt-0.5 size-4 shrink-0", p.destacado ? "text-marca-400" : "text-marca-600")} />
                    <span className={p.destacado ? "text-white/85" : "text-neutral-700"}>{i}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/contacto?origen=/precios`}
                className={cn(
                  "mt-10 justify-center",
                  p.destacado ? botonPrincipal : botonBorde,
                )}
              >
                Pedir presupuesto <ArrowRightIcon className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Seccion etiqueta="Cómo se cobra" titulo="Un modelo sencillo." destacado="Sin letra pequeña.">
        <Tarjetas items={MODELO} columnas={2} />
      </Seccion>

      <Seccion
        oscuro
        etiqueta="Lo que necesitas"
        titulo="Tres cosas tuyas."
        destacado="El resto lo ponemos nosotros."
        texto={<p>El agente de voz, el panel, la integración y el acompañamiento en el alta van incluidos.</p>}
      >
        <Tarjetas items={NECESITAS} oscuro />
      </Seccion>

      <Seccion etiqueta="Puesta en marcha" titulo="De la primera conversación" destacado="a la primera cita.">
        <Pasos items={ALTA} />
      </Seccion>

      <Preguntas items={PREGUNTAS} />

      <CtaFinal
        titulo="Cuéntanos tu volumen."
        destacado="Te damos una cifra cerrada."
        origen="/precios"
        secundaria={{ href: "/seguridad", texto: "Seguridad y RGPD" }}
      />
    </main>
  );
}

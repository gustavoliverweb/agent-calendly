import type { Metadata } from "next";
import { CtaFinal, Hero, Preguntas, Seccion } from "@/components/landing/bloques";
import { marcaPlataforma } from "@/lib/marca-plataforma";

export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaPlataforma();
  return {
    title: "Integraciones",
    description: `Con qué se conecta ${marca.nombre}: tu Calendly para reservar citas, la línea SIP de tu operador para llamar desde tu número y archivos CSV para traer tus contactos desde Excel o tu CRM.`,
    alternates: { canonical: "/integraciones" },
  };
}

type Integracion = {
  nombre: string;
  tipo: string;
  resumen: string;
  como: string[];
  necesitas: string;
};

/*
 * Solo lo que la plataforma hace hoy. Cuando haya integraciones nuevas
 * (otro calendario, un CRM), se añaden aquí.
 */
const INTEGRACIONES: Integracion[] = [
  {
    nombre: "Calendly",
    tipo: "Agenda",
    resumen: "El agente consulta tus huecos y reserva la cita durante la llamada.",
    como: [
      "Conectas tu cuenta desde el panel con el botón de Calendly, sin copiar claves.",
      "Eliges el tipo de evento en el que se reservan las citas.",
      "La persona recibe el email de confirmación de Calendly, con su enlace para cambiar o cancelar.",
      "Si cambia la hora o cancela, el panel lo refleja solo: la cita se actualiza y el contacto queda para seguimiento.",
    ],
    necesitas: "Un plan de pago de Calendly: es el que permite reservar desde otra aplicación.",
  },
  {
    nombre: "Tu línea de teléfono",
    tipo: "Telefonía (SIP)",
    resumen: "Las llamadas salen desde el número de tu empresa.",
    como: [
      "Tu operador te da los datos de la línea SIP (la que usan las centralitas virtuales).",
      "Nosotros la damos de alta y la asociamos a tu cuenta.",
      "Quien recibe la llamada ve tu número, no uno desconocido.",
      "Los minutos de conversación se cuentan en tu panel, con el límite mensual que elijas.",
    ],
    necesitas: "Una línea con SIP de tu operador o de tu centralita virtual. Si no sabes si la tienes, te ayudamos a pedirla.",
  },
  {
    nombre: "Hojas de cálculo y CRM",
    tipo: "Importación CSV",
    resumen: "Tus contactos entran desde un archivo, vengan de donde vengan.",
    como: [
      "Exporta un CSV desde Excel, Google Sheets, tu CRM o el formulario de tu web.",
      "El panel reconoce las columnas habituales (nombre, teléfono, email, consentimiento…) aunque se llamen distinto.",
      "Revisas la vista previa: teléfonos no válidos, duplicados y contactos sin consentimiento, antes de importar.",
      "Hasta 5.000 contactos por archivo. Para campañas a empresas, hay una plantilla descargable.",
      "Y de vuelta: exporta tus contactos, con el resultado de las llamadas, para llevarlos a tu CRM.",
    ],
    necesitas: "Un archivo CSV con al menos nombre y teléfono. La guía de la lista de contactos explica el resto.",
  },
  {
    nombre: "Exportación del uso",
    tipo: "Informes CSV",
    resumen: "El resumen de cada mes, listo para tu contabilidad.",
    como: [
      "Minutos, llamadas, citas e importe estimado de cada mes.",
      "Detalle llamada a llamada, sin datos personales de tus contactos.",
      "Se abre en Excel o Google Sheets.",
    ],
    necesitas: "Nada: está en la sección Uso del panel.",
  },
];

const PREGUNTAS: [string, string][] = [
  [
    "¿Funciona con Google Calendar u Outlook?",
    "A través de Calendly, sí: conecta Calendly a tu Google Calendar u Outlook y el agente verá tu disponibilidad real. Directamente, sin Calendly, todavía no.",
  ],
  [
    "¿Se conecta con mi CRM?",
    "Hoy los contactos entran y salen por CSV, que cualquier CRM sabe importar y exportar. Si necesitas una integración directa, cuéntanos cuál usas: nos ayuda a decidir las siguientes.",
  ],
  [
    "¿Necesito cambiar de operador de teléfono?",
    "No, si tu operador ofrece líneas SIP, que es lo habitual en las centralitas virtuales. Mantienes tu número.",
  ],
  [
    "¿Quién pone la voz y la inteligencia artificial?",
    "Va incluida: usamos un proveedor especializado en voz con IA y tú solo pagas los minutos de conversación. No tienes que abrir ninguna cuenta aparte.",
  ],
];

export default function IntegracionesPage() {
  return (
    <main className="bg-white">
      <Hero
        titulo="Se conecta a lo que ya usas."
        destacado="Sin programar nada."
        texto={
          <p>
            Tu agenda de Calendly, tu número de teléfono y tus listas de contactos. Lo conectas una vez desde el panel y el
            agente trabaja con ello en cada llamada.
          </p>
        }
        principal={{ href: "/contacto?origen=/integraciones", texto: "Solicitar una demo" }}
        secundaria={{ href: "/recursos/que-necesitas-para-empezar", texto: "Qué necesitas para empezar" }}
        onda={false}
      />

      <Seccion apilada titulo="Cuatro piezas." destacado="Todo lo demás lo ponemos nosotros.">
        <ul className="border-b border-carbon/10">
          {INTEGRACIONES.map((i) => (
            <li key={i.nombre} className="grid gap-6 border-t border-carbon/10 py-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
              <div>
                <h3 className="text-[31px] leading-tight font-semibold tracking-[-0.025em] [font-stretch:86%]">{i.nombre}</h3>
                <p className="mt-1 text-[15px] text-marca-700">{i.tipo}</p>
                <p className="mt-4 text-[20px] leading-snug text-carbon">{i.resumen}</p>
              </div>
              <div>
                <ul className="flex flex-col gap-3 text-[17px] leading-relaxed text-ceniza">
                  {i.como.map((c) => (
                    <li key={c} className="flex gap-3">
                      <span className="mt-[0.7em] size-1 shrink-0 rounded-full bg-marca-600" aria-hidden />
                      {c}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 rounded-xl bg-marca-50 px-5 py-4 text-[16px] leading-relaxed text-carbon">
                  <strong className="font-semibold">Necesitas:</strong> {i.necesitas}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Seccion>

      <Preguntas items={PREGUNTAS} />

      <CtaFinal titulo="¿Usas otra herramienta?" destacado="Cuéntanos cuál." origen="/integraciones" />
    </main>
  );
}

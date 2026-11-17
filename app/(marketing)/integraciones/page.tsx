import type { Metadata } from "next";
import { CtaFinal, Hero, Preguntas, Seccion } from "@/components/landing/bloques";
import { etiqueta } from "@/components/landing/estilos";
import { MARCA } from "@/lib/marca";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Integraciones",
  description: `Con qué se conecta ${MARCA.nombre}: tu Calendly para reservar citas, la línea SIP de tu operador para llamar desde tu número y archivos CSV para traer tus contactos desde Excel o tu CRM.`,
  alternates: { canonical: "/integraciones" },
};

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
    "Hoy los contactos entran por CSV, que cualquier CRM sabe exportar. Si necesitas una integración directa, cuéntanos cuál usas: nos ayuda a decidir las siguientes.",
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
    <main className="bg-white text-neutral-950">
      <Hero
        etiqueta="Integraciones"
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

      <Seccion etiqueta="Conexiones" titulo="Cuatro piezas." destacado="Todo lo demás lo ponemos nosotros.">
        <ul className="flex flex-col gap-5">
          {INTEGRACIONES.map((i) => (
            <li
              key={i.nombre}
              className="grid gap-8 rounded-3xl border border-neutral-200 p-7 sm:p-9 lg:grid-cols-[1fr_1.5fr] lg:gap-14"
            >
              <div>
                <p className={cn(etiqueta, "text-marca-600")}>{i.tipo}</p>
                <h3 className="mt-5 text-3xl tracking-[-0.03em]">{i.nombre}</h3>
                <p className="mt-3 text-lg leading-relaxed text-neutral-600">{i.resumen}</p>
              </div>
              <div>
                <ol className="flex flex-col gap-3">
                  {i.como.map((c, n) => (
                    <li key={c} className="grid grid-cols-[2rem_1fr] leading-relaxed text-neutral-700">
                      <span className="font-mono text-sm text-marca-500 tabular-nums">{String(n + 1).padStart(2, "0")}</span>
                      {c}
                    </li>
                  ))}
                </ol>
                <p className="mt-6 rounded-2xl bg-neutral-50 px-5 py-4 text-[15px] leading-relaxed text-neutral-600">
                  <span className="text-neutral-950">Necesitas: </span>
                  {i.necesitas}
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

import type { SECTORES } from "./contacto";

/**
 * Contenido de las páginas /soluciones/<slug>. Todo el texto está aquí para
 * poder editarlo sin tocar el diseño. Sin cifras ni testimonios inventados:
 * cuando haya casos reales, se añaden aquí.
 */

export type Turno = { quien: "agente" | "contacto" | "nota"; texto: string };

export type Solucion = {
  slug: string;
  /** Preselecciona el sector en el formulario de contacto. */
  sector: (typeof SECTORES)[number];
  menu: string;
  seo: { titulo: string; descripcion: string };
  hero: { etiqueta: string; titulo: string; destacado: string; texto: string };
  problema: { titulo: string; destacado: string; items: [string, string][] };
  pasos: { titulo: string; destacado: string; items: { clave: string; titulo: string; texto: string }[] };
  dialogo?: { titulo: string; texto: string; conversacion: { titulo: string; turnos: Turno[] } };
  beneficios: { titulo: string; destacado: string; items: [string, string][] };
  preguntas: [string, string][];
  cta: { titulo: string; destacado: string };
};

export const SOLUCIONES: Solucion[] = [
  {
    slug: "clinicas",
    sector: "Clínica o centro de salud",
    menu: "Clínicas",
    seo: {
      titulo: "Agente de voz con IA para clínicas",
      descripcion:
        "Llama a cada paciente interesado, resuelve sus dudas y le da cita en tu agenda de Calendly. Para clínicas dentales, de estética, fisioterapia y centros de salud.",
    },
    hero: {
      etiqueta: "Para clínicas y centros de salud",
      titulo: "Cada paciente interesado, con su cita.",
      destacado: "Sin colapsar la recepción.",
      texto:
        "El agente llama a quienes piden información, les explica la primera visita y les reserva hueco en tu agenda. Tu equipo atiende a los pacientes que ya están en la clínica.",
    },
    problema: {
      titulo: "Los leads no esperan.",
      destacado: "Tu recepción no puede con todo.",
      items: [
        [
          "El interés se enfría",
          "Quien rellena un formulario a las once de la noche compara clínicas esa misma semana. Si la llamada llega tarde, otra ya le ha dado cita.",
        ],
        [
          "La recepción va a tope",
          "Entre pacientes en sala, teléfono y cobros, devolver llamadas a leads siempre queda para luego.",
        ],
        [
          "Los que no contestan se pierden",
          "Un primer intento sin respuesta suele ser el último. Nadie lleva la cuenta de a quién volver a llamar.",
        ],
      ],
    },
    pasos: {
      titulo: "Así llena tu agenda",
      destacado: "mientras atiendes la clínica.",
      items: [
        {
          clave: "Importa",
          titulo: "Sube tus leads.",
          texto: "Desde un CSV de tu formulario, de tus campañas o de tu software de gestión, con el consentimiento de cada contacto.",
        },
        {
          clave: "Llama",
          titulo: "Llama en tu horario.",
          texto: "Por lotes y con las llamadas simultáneas que elijas, solo en tus franjas y nunca en festivos. Si no contestan, reintenta otro día.",
        },
        {
          clave: "Explica",
          titulo: "Resuelve las dudas con tu guion.",
          texto: "Qué incluye la primera visita, dónde estáis, cuánto dura. Lo que no esté en tu guion, lo deja para la cita: no inventa.",
        },
        {
          clave: "Agenda",
          titulo: "Reserva en tu Calendly.",
          texto: "Ofrece huecos reales, reserva al momento y el paciente recibe la confirmación por email. Si cancela o cambia la hora, el panel se actualiza solo.",
        },
      ],
    },
    dialogo: {
      titulo: "Una primera visita, agendada.",
      texto: "Un ejemplo con el guion de una clínica dental. El agente se presenta como asistente virtual desde la primera frase.",
      conversacion: {
        titulo: "Clínica dental · lead de formulario web",
        turnos: [
          {
            quien: "agente",
            texto:
              "Hola, ¿hablo con Laura? Le llamo de Clínica Sonrisa. Soy Clara, una asistente virtual con inteligencia artificial, y esta llamada se transcribe para gestionar su cita.",
          },
          { quien: "contacto", texto: "Sí, soy yo. Pedí información sobre una revisión." },
          {
            quien: "agente",
            texto:
              "Perfecto. La primera visita incluye revisión completa y presupuesto sin compromiso, y dura unos treinta minutos. ¿Qué días le vienen mejor?",
          },
          { quien: "contacto", texto: "El jueves por la tarde." },
          { quien: "nota", texto: "consulta la disponibilidad del jueves en Calendly" },
          { quien: "agente", texto: "El jueves tengo a las 17:00 o a las 18:30. ¿Cuál prefiere?" },
          { quien: "contacto", texto: "A las 17:00." },
          { quien: "nota", texto: "reserva la cita y envía la confirmación por email" },
          { quien: "agente", texto: "Listo, jueves a las 17:00. Le llega ahora la confirmación al correo que nos dejó." },
        ],
      },
    },
    beneficios: {
      titulo: "Más primeras visitas.",
      destacado: "Menos teléfono.",
      items: [
        ["Huecos reales", "Consulta tu agenda durante la llamada. Si un hueco se ocupa mientras habla, ofrece otro sin colgar."],
        ["Reintentos automáticos", "Quien no contesta vuelve a la cola otro día y a otra hora, según tus reglas."],
        ["Sin datos de salud", "El agente no pregunta por síntomas ni historial: su trabajo es explicar la visita y darle cita."],
        ["Cada llamada, transcrita", "Lees qué preguntó cada paciente y qué se le respondió. Ideal para mejorar tu guion."],
        ["Rellamadas cuando lo piden", "Si alguien pide que le llamen más tarde, queda en seguimiento con el momento que indicó."],
        ["Consentimiento registrado", "En campañas comerciales solo llama a quien dio su consentimiento, con fecha y origen."],
      ],
    },
    preguntas: [
      [
        "¿Y si el paciente pregunta por precios o tratamientos?",
        "Responde con lo que pongas en tu guion: precios orientativos, qué incluye la primera visita, formas de pago. Si le preguntan algo que no está, lo deja para la consulta en lugar de improvisar.",
      ],
      [
        "¿Puede el paciente cambiar o cancelar la cita?",
        "Sí, desde el email de confirmación de Calendly. El panel refleja el cambio y, si cancela, el contacto queda para seguimiento.",
      ],
      [
        "¿Necesito cambiar de agenda?",
        "Si ya usas Calendly, no: solo necesitas un plan de pago, que es el que permite reservar desde otra aplicación. Si usas otra agenda, cuéntanoslo en la demo.",
      ],
      [
        "¿Qué pasa con la protección de datos?",
        "El agente se identifica como IA, avisa de que la llamada se transcribe y respeta a quien pide no ser llamado. Tú decides cuánto tiempo se guardan las conversaciones.",
      ],
    ],
    cta: { titulo: "Tu agenda puede llenarse sola.", destacado: "Te lo enseñamos con tu guion." },
  },
  {
    slug: "b2b",
    sector: "Servicios a empresas (B2B)",
    menu: "Prospección B2B",
    seo: {
      titulo: "Agente de voz con IA para prospección B2B",
      descripcion:
        "Llama a empresas, pasa la recepción, llega a la persona que decide y agenda la reunión en el calendario de tu comercial. Con el origen de los datos documentado.",
    },
    hero: {
      etiqueta: "Prospección B2B",
      titulo: "De la centralita a la reunión.",
      destacado: "Sin que tu equipo marque un número.",
      texto:
        "El agente llama a las empresas de tu lista, pide que le pasen con la persona indicada y, cuando llega a quien decide, agenda la reunión en el calendario de tu comercial.",
    },
    problema: {
      titulo: "La llamada en frío cansa.",
      destacado: "Y casi nunca llega a quien decide.",
      items: [
        [
          "Recepción es un filtro",
          "La mayoría de llamadas mueren en la centralita: «no está», «llame más tarde», «mande un email».",
        ],
        [
          "Tu equipo comercial se quema",
          "Horas marcando números para unas pocas conversaciones útiles. El tiempo de tus comerciales vale más en las reuniones.",
        ],
        [
          "Los pases se pierden",
          "«Hable con Marta, de compras, los martes». Si nadie lo apunta en el momento, esa pista desaparece.",
        ],
      ],
    },
    pasos: {
      titulo: "Así trabaja",
      destacado: "una lista de empresas.",
      items: [
        {
          clave: "Importa",
          titulo: "Empresas, cargos y origen.",
          texto: "Sube tu lista con la empresa, el cargo que buscas, la web y de dónde salen los datos. El teléfono puede ser la centralita.",
        },
        {
          clave: "Llega",
          titulo: "Pasa la recepción con educación.",
          texto: "Se presenta como asistente virtual, explica el motivo en una frase y pide que le pasen con la persona o el cargo indicado.",
        },
        {
          clave: "Anota",
          titulo: "Si no está, no se pierde.",
          texto: "Pregunta cuándo es mejor llamar y si hay un teléfono directo. Si le remiten a otra persona, guarda su nombre y su cargo.",
        },
        {
          clave: "Agenda",
          titulo: "La reunión, en el calendario del comercial.",
          texto: "Con quien decide, ofrece huecos reales y reserva la reunión en Calendly. Tú recibes la cita; el comercial, la conversación transcrita.",
        },
      ],
    },
    dialogo: {
      titulo: "Una centralita, una reunión.",
      texto: "Un ejemplo de llamada a una empresa: recepción, pase y reunión con la persona que decide.",
      conversacion: {
        titulo: "Prospección · empresa de construcción",
        turnos: [
          {
            quien: "agente",
            texto:
              "Buenos días, le llamo de Grupo Delta. Soy Clara, una asistente virtual con inteligencia artificial, y esta llamada se transcribe. ¿Podría hablar con Pedro Ruiz, el gerente?",
          },
          { quien: "contacto", texto: "Un momento, le paso." },
          { quien: "nota", texto: "pase a otra persona" },
          {
            quien: "agente",
            texto:
              "Hola, Pedro. Soy Clara, la asistente virtual de Grupo Delta; la llamada se transcribe. Ayudamos a constructoras a controlar el gasto de obra. ¿Le encaja una reunión de veinte minutos con un consultor?",
          },
          { quien: "contacto", texto: "Puede ser. ¿El martes?" },
          { quien: "nota", texto: "consulta la disponibilidad del martes en Calendly" },
          { quien: "agente", texto: "El martes tengo a las 10:00 o a las 12:30." },
          { quien: "contacto", texto: "A las 10:00." },
          { quien: "nota", texto: "reserva la reunión en el calendario del comercial" },
        ],
      },
    },
    beneficios: {
      titulo: "Más conversaciones con quien decide.",
      destacado: "Menos llamadas en frío.",
      items: [
        ["Instrucciones para recepción", "Breve, educado y sin dar detalles comerciales a quien no decide."],
        ["Pases convertidos en seguimiento", "Nombre, cargo, teléfono directo y mejor momento quedan en el contacto, listos para la siguiente llamada."],
        ["Resultados claros", "Cada llamada se clasifica: cita, pasado a otra persona, decisor no disponible, no interesado o no llamar."],
        ["Origen de los datos documentado", "Cada contacto guarda de dónde salen sus datos. Sin ese dato, el sistema no lo llama."],
        ["Identificado como IA", "Se presenta como asistente virtual al empezar y otra vez si le pasan con otra persona."],
        ["Respeta el «no llaméis más»", "Si una empresa o una persona lo pide, queda excluida al momento."],
      ],
    },
    preguntas: [
      [
        "¿Es legal llamar a empresas sin consentimiento previo?",
        "Las llamadas a empresas pueden apoyarse en el interés legítimo, con el origen de los datos documentado y respetando el derecho de oposición. Por eso activamos el modo B2B después de revisar contigo la base jurídica de tu campaña.",
      ],
      [
        "¿Y si llamo a autónomos?",
        "Un autónomo es una persona física y no siempre valen las mismas reglas. Es una de las cosas que revisamos antes de activar la campaña.",
      ],
      [
        "¿Puede pasar la llamada en directo a mi comercial?",
        "No: el agente agenda la reunión en el calendario del comercial. Así llega preparado, con la transcripción de la llamada.",
      ],
      [
        "¿Qué pasa cuando no consigue hablar con quien decide?",
        "La llamada queda como «pasado a otra persona» o «decisor no disponible», y el contacto, en seguimiento con lo que le dijeron: a quién llamar, cuándo y a qué número.",
      ],
    ],
    cta: { titulo: "Tus comerciales, en reuniones.", destacado: "Las llamadas, para el agente." },
  },
  {
    slug: "agencias",
    sector: "Agencia",
    menu: "Agencias (marca blanca)",
    seo: {
      titulo: "Agente de voz con IA en marca blanca para agencias",
      descripcion:
        "Ofrece a tus clientes un agente de voz que llama a sus leads y agenda citas, con tu marca y tu dominio. Cada cliente con su cuenta aislada y su uso para facturar.",
    },
    hero: {
      etiqueta: "Para agencias · Marca blanca",
      titulo: "Tu agente de voz con IA.",
      destacado: "Con tu marca.",
      texto:
        "Ofrece a tus clientes un agente que llama a sus leads y les agenda citas, con tu dominio, tu logo y tus colores. Sin desarrollar nada y sin mezclar los datos de un cliente con los de otro.",
    },
    problema: {
      titulo: "Tus clientes generan leads.",
      destacado: "Nadie los llama a tiempo.",
      items: [
        [
          "El cuello de botella está después del clic",
          "Tus campañas traen contactos, pero el resultado depende de que alguien les llame. Ahí se pierde buena parte del trabajo.",
        ],
        [
          "Construir un agente propio cuesta",
          "Voz, telefonía, calendario, cumplimiento legal y panel: meses de desarrollo y mantenimiento antes de cobrar el primer euro.",
        ],
        [
          "Muchos clientes, muchos datos",
          "Cada cliente necesita su guion, su agenda, su línea y la garantía de que nadie más ve sus contactos.",
        ],
      ],
    },
    pasos: {
      titulo: "Así lanzas el servicio",
      destacado: "con cada cliente.",
      items: [
        {
          clave: "Alta",
          titulo: "Damos de alta la cuenta del cliente.",
          texto: "Cada cliente tiene su propia cuenta, con sus usuarios, sus contactos y su configuración, aislada del resto.",
        },
        {
          clave: "Marca",
          titulo: "Con tu dominio y tu imagen.",
          texto: "El panel se abre en un dominio vuestro, con logo, color y favicon propios. Las páginas legales muestran los datos que indiquéis.",
        },
        {
          clave: "Configura",
          titulo: "Guion, Calendly y línea.",
          texto: "Escribes el guion del cliente en el panel y lo pruebas en el navegador; el cliente conecta su Calendly y damos de alta su línea.",
        },
        {
          clave: "Factura",
          titulo: "Cobras por uso, a tu precio.",
          texto: "Cada cuenta tiene un límite de minutos y un resumen mensual con exportación CSV para que factures con datos.",
        },
      ],
    },
    beneficios: {
      titulo: "Todo lo que necesitas para revender.",
      destacado: "Nada que construir.",
      items: [
        ["Dominio propio con HTTPS", "Cada cuenta puede entrar por su dominio, por ejemplo llamadas.tucliente.com, con certificado automático."],
        ["Tu imagen en el panel", "Logo, color principal y favicon en el login, el panel y las páginas legales."],
        ["Datos aislados por cliente", "Ningún cliente ve los contactos, llamadas o guiones de otro. Lo garantiza la propia base de datos."],
        ["Límites que controlan el coste", "Minutos al mes y llamadas simultáneas por cuenta: ningún cliente se dispara."],
        ["Demos en el navegador", "Prueba el agente con el guion de un cliente potencial sin marcar ningún teléfono."],
        ["Uso exportable", "Minutos, llamadas, citas y detalle de cada llamada por mes, en CSV."],
      ],
    },
    preguntas: [
      [
        "¿Mis clientes verán vuestra marca?",
        "En su dominio, no: el login, el panel y las páginas legales llevan la marca que configuréis.",
      ],
      [
        "¿Quién da el soporte al cliente final?",
        "Lo acordamos contigo según tu modelo: puedes ser el primer nivel de soporte para tus clientes y contar con nosotros detrás.",
      ],
      [
        "¿Cómo facturo a mis clientes?",
        "A tu precio. Cada cuenta tiene su resumen mensual de minutos, llamadas y citas, exportable a CSV.",
      ],
      [
        "¿Qué necesita cada cliente?",
        "Una cuenta de Calendly de pago, una línea de teléfono con su operador y su lista de contactos. El resto lo preparamos contigo.",
      ],
    ],
    cta: { titulo: "Añade voz con IA a tus servicios.", destacado: "Con tu marca, desde el primer cliente." },
  },
];

export function solucionPorSlug(slug: string): Solucion | undefined {
  return SOLUCIONES.find((s) => s.slug === slug);
}

/**
 * Guías de /recursos. Todo el texto está aquí para editarlo sin tocar el
 * diseño. Solo describen cómo funciona la plataforma hoy: si cambia el
 * panel (columnas del CSV, apartados del guion…), hay que revisarlas.
 */

export type Bloque =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; items: string[] }
  | { tipo: "tabla"; cabecera: [string, string]; filas: [string, string][] }
  | { tipo: "ejemplo"; titulo: string; texto: string }
  | { tipo: "nota"; texto: string };

export type Recurso = {
  slug: string;
  categoria: "Primeros pasos" | "Guion" | "Contactos";
  titulo: string;
  resumen: string;
  /** Minutos de lectura aproximados. */
  lectura: number;
  /** Fecha de la última revisión (AAAA-MM-DD). */
  revisado: string;
  secciones: { titulo: string; bloques: Bloque[] }[];
};

export const RECURSOS: Recurso[] = [
  {
    slug: "que-necesitas-para-empezar",
    categoria: "Primeros pasos",
    titulo: "Qué necesitas para empezar",
    resumen: "Las cuatro cosas que hay que tener listas antes de la primera llamada, y lo que ponemos nosotros.",
    lectura: 4,
    revisado: "2026-11-17",
    secciones: [
      {
        titulo: "En resumen",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "Para que el agente llame y agende necesitas cuatro piezas: una agenda de Calendly, una línea de teléfono, tu lista de contactos y un guion. El agente de voz, el panel y la configuración técnica los ponemos nosotros.",
          },
          {
            tipo: "tabla",
            cabecera: ["Qué", "Quién lo aporta"],
            filas: [
              ["Cuenta de Calendly de pago", "Tú"],
              ["Línea de teléfono con SIP", "Tú, con tu operador (te ayudamos)"],
              ["Lista de contactos en CSV", "Tú"],
              ["Guion de la llamada", "Tú, con nuestra ayuda"],
              ["Agente de voz, panel y alta de la línea", "Nosotros"],
            ],
          },
        ],
      },
      {
        titulo: "1. Calendly de pago",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "El agente reserva las citas en tu Calendly durante la llamada. Calendly solo permite reservar desde otra aplicación en sus planes de pago, así que el plan gratuito no sirve.",
          },
          {
            tipo: "lista",
            items: [
              "Crea un tipo de evento para estas citas (por ejemplo, «Primera visita») con su duración y tu disponibilidad.",
              "Si quieres que la persona reciba la confirmación por email, revisa que el tipo de evento la tenga activada.",
              "Desde el panel conectas tu cuenta con el botón de Calendly y eliges ese tipo de evento. No hay que copiar claves.",
            ],
          },
          {
            tipo: "nota",
            texto: "Si conectas Calendly a tu Google Calendar u Outlook, el agente solo ofrecerá huecos en los que de verdad estás libre.",
          },
        ],
      },
      {
        titulo: "2. Una línea de teléfono con SIP",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "Las llamadas salen desde un número de tu empresa. Para eso tu operador tiene que darte una línea SIP, que es la que usan las centralitas virtuales. La mayoría de operadores de empresa la ofrecen.",
          },
          {
            tipo: "lista",
            items: [
              "Pide a tu operador los datos de la línea SIP del número que quieras usar.",
              "Nos los pasas y damos de alta la línea en tu cuenta.",
              "Quien recibe la llamada verá ese número.",
            ],
          },
        ],
      },
      {
        titulo: "3. Tu lista de contactos",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "Un archivo CSV exportado de Excel, Google Sheets, tu CRM o el formulario de tu web, con al menos el nombre y el teléfono de cada persona. En campañas comerciales, además, si dio su consentimiento para que la llames.",
          },
          {
            tipo: "nota",
            texto: "Tienes todos los detalles en la guía «Cómo preparar tu lista de contactos».",
          },
        ],
      },
      {
        titulo: "4. El guion",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "Es lo que el agente sabe de tu negocio: a qué te dedicas, por qué llamas, qué ofreces y qué cita quieres conseguir. Se escribe en el panel por apartados y se prueba en el navegador antes de llamar a nadie.",
          },
          {
            tipo: "nota",
            texto: "Tienes una guía paso a paso en «Cómo escribir el guion de tu agente».",
          },
        ],
      },
      {
        titulo: "Y antes de lanzar",
        bloques: [
          {
            tipo: "lista",
            items: [
              "Configura tus franjas de llamada y los festivos.",
              "Decide cuántas veces reintentar a quien no contesta y cuántas horas esperar entre intentos.",
              "Elige el tipo de campaña (comercial, no comercial o a empresas) según la base jurídica que te indique tu asesor.",
              "Haz un lote pequeño de prueba y lee las transcripciones antes de lanzar el resto.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "como-escribir-el-guion",
    categoria: "Guion",
    titulo: "Cómo escribir el guion de tu agente",
    resumen: "Qué poner en cada apartado, cómo debe ser el primer mensaje y cómo probarlo antes de llamar a nadie.",
    lectura: 6,
    revisado: "2026-11-17",
    secciones: [
      {
        titulo: "La idea",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "El agente ya sabe conversar, presentarse, consultar tu agenda y reservar. Lo que no sabe es nada de tu negocio: eso es el guion. No es un texto para leer palabra por palabra, sino la información con la que el agente responde.",
          },
          {
            tipo: "parrafo",
            texto:
              "Escribe como se lo explicarías a una persona nueva en recepción: frases cortas, datos concretos y sin jerga. Lo que no esté en el guion, el agente no lo inventa: lo deja para la cita.",
          },
        ],
      },
      {
        titulo: "Los apartados",
        bloques: [
          {
            tipo: "tabla",
            cabecera: ["Apartado", "Qué poner"],
            filas: [
              ["A qué se dedica", "Tu negocio en dos o tres frases: qué haces, para quién y dónde."],
              ["Motivo de la llamada", "Por qué llamas a esta persona: pidió información, descargó una guía, es cliente antiguo…"],
              ["Oferta", "Qué le propones y qué incluye. Si hay precio orientativo o promoción, aquí."],
              ["La cita", "Qué tipo de cita se agenda, cuánto dura, si es presencial o en línea y qué debe traer."],
              ["Preguntas frecuentes", "Las dudas que más repiten tus clientes, con su respuesta. Opcional, pero muy recomendable."],
              ["Objeciones", "Lo que suelen responder para decir que no («es caro», «ya tengo proveedor») y cómo contestas tú. Opcional."],
              ["Lo que no debes decir", "Límites: precios que no se dan por teléfono, promesas que no puedes hacer, temas que no tocar. Opcional."],
            ],
          },
          {
            tipo: "nota",
            texto:
              "Los cuatro primeros son obligatorios. El texto completo tiene un límite de longitud: mejor concreto que exhaustivo.",
          },
        ],
      },
      {
        titulo: "El primer mensaje",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "Es la primera frase que dice el agente al descolgar. Tiene que decir de qué negocio llama, que habla una asistente virtual o inteligencia artificial y que la llamada se transcribe. Si falta algo de eso, el panel no deja guardarlo.",
          },
          {
            tipo: "parrafo",
            texto: "Puedes usar marcadores que se sustituyen en cada llamada:",
          },
          {
            tipo: "lista",
            items: [
              "{nombre}: nombre de la persona a la que se llama.",
              "{negocio}: nombre de tu negocio.",
              "{agente}: nombre del agente.",
              "{empresa} y {cargo}: empresa y cargo del contacto, en campañas a empresas.",
            ],
          },
          {
            tipo: "ejemplo",
            titulo: "Ejemplo",
            texto:
              "Hola, ¿hablo con {nombre}? Le llamo de {negocio}. Soy {agente}, una asistente virtual con inteligencia artificial, y esta llamada se transcribe para gestionar su cita.",
          },
        ],
      },
      {
        titulo: "Consejos que funcionan",
        bloques: [
          {
            tipo: "lista",
            items: [
              "Un objetivo por guion. Si tienes dos campañas distintas, guarda dos versiones y activa la que toque.",
              "Datos, no adjetivos: «la primera visita dura 30 minutos y es gratuita» ayuda más que «ofrecemos un servicio excelente».",
              "Prepara las tres objeciones que más oyes. Es donde más se nota un buen guion.",
              "Di qué hacer con lo que no sabe: «si preguntan por financiación, di que se lo explican en la cita».",
              "No pidas datos sensibles: el agente no debe preguntar por salud, ingresos ni nada que no necesite para la cita.",
            ],
          },
        ],
      },
      {
        titulo: "Pruébalo antes de llamar",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "Desde la página del guion puedes hablar con el agente en el navegador, con tu guion y tu agenda reales. Hazlo varias veces poniéndote en el lugar de distintos clientes: el que tiene prisa, el que desconfía, el que pregunta el precio.",
          },
          {
            tipo: "parrafo",
            texto:
              "Cada vez que guardas, se crea una versión nueva. Las llamadas usan la versión activa y cada llamada recuerda con qué versión se hizo, así que puedes comparar resultados entre versiones.",
          },
          {
            tipo: "nota",
            texto: "Las pruebas en el navegador consumen minutos como una llamada normal y cuentan para tu límite mensual.",
          },
        ],
      },
    ],
  },
  {
    slug: "preparar-lista-de-contactos",
    categoria: "Contactos",
    titulo: "Cómo preparar tu lista de contactos",
    resumen: "Qué columnas necesita el CSV, cómo indicar el consentimiento y qué revisa el panel antes de importar.",
    lectura: 5,
    revisado: "2026-11-17",
    secciones: [
      {
        titulo: "El archivo",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "Un archivo CSV, separado por comas o por punto y coma (el que guarda Excel en español). La primera fila tiene que ser la de los nombres de las columnas. Hasta 5.000 contactos por archivo: si tienes más, divídelo.",
          },
        ],
      },
      {
        titulo: "Las columnas",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "El panel reconoce las columnas aunque no se llamen exactamente así (por ejemplo, «Móvil» o «Teléfono» para el teléfono) y te deja corregir la asignación antes de importar.",
          },
          {
            tipo: "tabla",
            cabecera: ["Columna", "Para qué"],
            filas: [
              ["Nombre", "Obligatoria. El agente saluda por el nombre."],
              ["Teléfono", "Obligatoria. Sin prefijo se entiende que es español."],
              ["Email", "Para la confirmación de la cita. Si no lo hay, el agente lo pide durante la llamada."],
              ["Consentimiento", "Si aceptó que le llames: «sí», «x», «1»… Vacío o «no» cuenta como que no."],
              ["Fecha de consentimiento", "Cuándo lo dio, en formato 25/03/2026 o 2026-03-25."],
              ["Origen del consentimiento", "Dónde lo dio: formulario web, feria, llamada…"],
              ["Notas", "Cualquier contexto útil para ti, como el servicio por el que preguntó."],
            ],
          },
        ],
      },
      {
        titulo: "El consentimiento",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "En una campaña comercial, el sistema solo llama a los contactos marcados con consentimiento, tanto al crear el lote como justo antes de cada llamada. Guardar la fecha y el origen te permite demostrar después de dónde salió.",
          },
          {
            tipo: "parrafo",
            texto:
              "Puedes importar contactos sin consentimiento (el panel te avisa), pero no entrarán en lotes de campañas comerciales. Si son clientes con los que ya tienes relación, puede encajar una campaña no comercial: decídelo con tu asesor.",
          },
        ],
      },
      {
        titulo: "Lo que revisa el panel",
        bloques: [
          {
            tipo: "parrafo",
            texto: "Antes de importar ves una vista previa de cada fila con lo que se va a hacer:",
          },
          {
            tipo: "lista",
            items: [
              "Teléfono inválido o sin nombre: la fila no se importa.",
              "Duplicado en el archivo o ya existente en tu cuenta: no se vuelve a crear.",
              "Email no válido: se importa el contacto sin el email.",
              "Teléfono no español o fecha no reconocida: se importa y se te avisa para que lo revises.",
            ],
          },
        ],
      },
      {
        titulo: "Campañas a empresas",
        bloques: [
          {
            tipo: "parrafo",
            texto:
              "Si llamas a otras empresas, añade estas columnas. En la página de importación hay una plantilla descargable con todas.",
          },
          {
            tipo: "tabla",
            cabecera: ["Columna", "Para qué"],
            filas: [
              ["Empresa", "Obligatoria en campañas B2B. El agente pregunta por ella."],
              ["Cargo", "Para pedir que le pasen con la persona adecuada."],
              ["Origen de los datos", "Obligatoria en campañas B2B: de dónde salen los datos del contacto."],
              ["Sector y web", "Opcionales, para tu referencia."],
            ],
          },
          {
            tipo: "nota",
            texto:
              "Cada teléfono es un contacto. Si varias personas comparten la misma centralita, de momento solo puede haber una en la lista.",
          },
        ],
      },
    ],
  },
];

export function recursoPorSlug(slug: string): Recurso | undefined {
  return RECURSOS.find((r) => r.slug === slug);
}

import type { Metadata } from "next";
import Link from "next/link";
import { CtaFinal, Hero, Preguntas, Seccion, Tarjetas } from "@/components/landing/bloques";
import { etiqueta } from "@/components/landing/estilos";
import { MARCA } from "@/lib/marca";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Seguridad y RGPD",
  description: `Cómo ${MARCA.nombre} cumple el RGPD y la normativa de llamadas comerciales: agente identificado como IA, consentimiento registrado, lista de exclusión, datos en la UE y aislamiento por empresa.`,
  alternates: { canonical: "/seguridad" },
};

const LLAMADA: [string, string][] = [
  [
    "Se presenta como asistente virtual",
    "La primera frase de cada llamada dice que habla una inteligencia artificial y que la conversación se transcribe. El panel no deja guardar un saludo que no lo diga.",
  ],
  [
    "«No me llaméis más» se cumple al momento",
    "Si alguien lo pide durante la llamada, el contacto queda excluido para siempre, también de los lotes que ya estaban en marcha.",
  ],
  [
    "Solo en tu horario",
    "Las llamadas salen dentro de las franjas que configuras y nunca en festivos. Fuera de horario, la cola espera.",
  ],
  [
    "Un botón para pararlo todo",
    "La pausa global detiene al instante cualquier llamada nueva. Cada lote se puede pausar o cancelar por separado.",
  ],
];

const CAMPANAS = [
  {
    tipo: "Comercial",
    regla: "Solo se llama a quien ha dado su consentimiento.",
    detalle: "Cada contacto guarda si consintió, cuándo y de dónde procede ese consentimiento. Sin él, el sistema no llama, ni siquiera desde un lote.",
  },
  {
    tipo: "No comercial",
    regla: "Para clientes con los que ya tienes relación.",
    detalle: "Recordatorios, seguimiento o reactivación de tus propios clientes, cuando la base jurídica no es el consentimiento.",
  },
  {
    tipo: "A empresas (B2B)",
    regla: "Llamadas a otras empresas, con el origen de los datos documentado.",
    detalle: "Cada contacto lleva su empresa y de dónde salen sus datos. Activamos este modo después de revisar contigo la base jurídica de tu campaña.",
  },
];

const DATOS: [string, string][] = [
  ["Alojados en la UE", "La aplicación y la base de datos funcionan en servidores de Fráncfort (Alemania)."],
  [
    "Cada empresa, aislada",
    "Tus contactos, llamadas y guiones solo son visibles para tu equipo. El aislamiento se aplica en la propia base de datos y se comprueba con pruebas automáticas.",
  ],
  [
    "Credenciales cifradas",
    "La conexión con tu Calendly se guarda cifrada. Todo el tráfico va por HTTPS y los avisos entre servicios llevan firma para que nadie pueda suplantarlos.",
  ],
  [
    "Retención que decides tú",
    "Las transcripciones y resúmenes se borran solos pasado el plazo que configures (por defecto, un año). Se conservan el resultado y la duración de cada llamada.",
  ],
  [
    "Derecho de supresión",
    "Borrar un contacto elimina sus datos, sus llamadas y sus transcripciones, también las conversaciones guardadas en el proveedor de voz.",
  ],
  [
    "Accesos con nombre",
    "Solo entran las personas que invitas, con rol de propietario u operador. Las acciones importantes quedan registradas.",
  ],
];

const PREGUNTAS: [string, string][] = [
  [
    "¿Es legal llamar con un agente de IA?",
    "Sí, siempre que se respeten las mismas reglas que una llamada comercial (consentimiento o base jurídica adecuada, horario, derecho de oposición) y que la persona sepa que habla con una IA. La plataforma aplica esas reglas por defecto; la base jurídica de cada campaña la decides tú con tu asesor.",
  ],
  [
    "¿Quién es el responsable de los datos de mis contactos?",
    "Tú. Nosotros tratamos esos datos por encargo tuyo, como encargados del tratamiento, con un contrato que lo regula y la lista de proveedores que intervienen.",
  ],
  [
    "¿Qué pasa si alguien pide que borremos sus datos?",
    "Lo borras desde la ficha del contacto en un clic: se eliminan sus datos y sus conversaciones. Si lo que pide es no recibir más llamadas, basta con marcarlo como «no llamar»: queda excluido para siempre.",
  ],
  [
    "¿Puedo llamar a autónomos en una campaña B2B?",
    "Un autónomo es una persona física, así que no siempre valen las mismas reglas que con una empresa. Por eso el modo B2B se activa tras revisar tu caso: es una pregunta para tu asesor antes de lanzar la campaña.",
  ],
  [
    "¿La web usa cookies de seguimiento?",
    "No. Solo una cookie técnica para mantener la sesión de quien entra al panel.",
  ],
];

export default function SeguridadPage() {
  return (
    <main className="bg-white text-neutral-950">
      <Hero
        etiqueta="Seguridad y RGPD"
        titulo="Llama a quien quiere."
        destacado="Respeta a quien no."
        texto={
          <p>
            {MARCA.nombre} está pensado para cumplir desde la primera llamada: el agente se identifica como IA, solo llama a
            quien puede llamar, en tu horario, y cualquier persona puede pedir que no la llamen más.
          </p>
        }
        principal={{ href: "/contacto?origen=/seguridad", texto: "Hablar con nosotros" }}
        secundaria={{ href: "/privacidad", texto: "Política de privacidad" }}
      />

      <Seccion
        oscuro
        etiqueta="En cada llamada"
        titulo="Transparente con quien contesta."
        destacado="Siempre."
      >
        <Tarjetas items={LLAMADA} oscuro columnas={2} />
      </Seccion>

      <Seccion
        etiqueta="Base legal"
        titulo="Cada campaña, con su regla."
        destacado="Aplicada por el sistema."
        texto={<p>Eliges el tipo de campaña y la plataforma decide a quién se puede llamar. Se comprueba al crear el lote y otra vez justo antes de cada llamada.</p>}
      >
        <ul className="grid gap-5 lg:grid-cols-3">
          {CAMPANAS.map((c) => (
            <li key={c.tipo} className="rounded-3xl border border-neutral-200 p-7 sm:p-8">
              <p className={cn(etiqueta, "text-marca-600")}>{c.tipo}</p>
              <h3 className="mt-5 text-xl tracking-[-0.02em]">{c.regla}</h3>
              <p className="mt-3 leading-relaxed text-neutral-600">{c.detalle}</p>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion etiqueta="Tus datos" titulo="Protegidos por diseño," destacado="no por promesa.">
        <Tarjetas items={DATOS} />
      </Seccion>

      <Seccion
        oscuro
        etiqueta="Quién es quién"
        titulo="Tú decides."
        destacado="Nosotros cumplimos tu encargo."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 p-7 sm:p-8">
            <p className={cn(etiqueta, "text-marca-400")}>Responsable del tratamiento</p>
            <h3 className="mt-5 text-2xl tracking-[-0.03em]">Tu empresa</h3>
            <p className="mt-3 leading-relaxed text-white/60">
              Decides a quién llamar, con qué base jurídica y durante cuánto tiempo se guardan las conversaciones.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 p-7 sm:p-8">
            <p className={cn(etiqueta, "text-marca-400")}>Encargado del tratamiento</p>
            <h3 className="mt-5 text-2xl tracking-[-0.03em]">{MARCA.nombre}</h3>
            <p className="mt-3 leading-relaxed text-white/60">
              Trata los datos solo para prestar el servicio, con un contrato de encargo y una lista cerrada de proveedores.
              Los detalles, en la{" "}
              <Link href="/privacidad" className="text-white underline underline-offset-4">
                política de privacidad
              </Link>
              .
            </p>
          </div>
        </div>
      </Seccion>

      <Preguntas items={PREGUNTAS} />

      <CtaFinal titulo="¿Dudas legales sobre tu campaña?" destacado="Las vemos contigo." origen="/seguridad" />
    </main>
  );
}

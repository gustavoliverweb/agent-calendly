import type { Metadata } from "next";
import { Calculadora } from "@/components/landing/calculadora";
import { CtaFinal, Hero, Preguntas, Seccion } from "@/components/landing/bloques";
import { MARCA } from "@/lib/marca";

export const metadata: Metadata = {
  title: "Calculadora de retorno",
  description: `Estima cuántas citas, clientes y minutos de conversación saldrían de tus leads con ${MARCA.nombre}, con tus propios números.`,
  alternates: { canonical: "/calculadora" },
};

const PREGUNTAS: [string, string][] = [
  [
    "¿De dónde salen los valores iniciales?",
    "Son un ejemplo para que la calculadora no aparezca vacía, no resultados de clientes. Cambia cada valor por los tuyos: los porcentajes dependen mucho de tu sector y de lo reciente que sea cada lead.",
  ],
  [
    "¿Por qué no cuenta las llamadas sin respuesta?",
    "Porque apenas consumen minutos de conversación. Los reintentos sí están dentro de «Contestan»: el porcentaje es el de leads que acaban cogiendo el teléfono alguna vez.",
  ],
  [
    "¿Cuál es el precio por minuto?",
    "Depende de tu plan y de tu volumen. Lo vemos contigo y, con tu propuesta delante, puedes volver aquí y comprobar el retorno.",
  ],
  [
    "¿Se guardan los datos que escribo?",
    "No. El cálculo se hace en tu navegador y no se envía a ningún sitio.",
  ],
];

export default function CalculadoraPage() {
  return (
    <main className="bg-white text-neutral-950">
      <Hero
        etiqueta="Calculadora de retorno"
        titulo="¿Cuántas citas hay en tus leads?"
        destacado="Haz la cuenta."
        texto={
          <p>
            Pon tus leads de un mes y tus porcentajes habituales. Verás cuántas citas y clientes saldrían si cada lead
            recibiera su llamada, y cuántos minutos de conversación supone.
          </p>
        }
        onda={false}
      />

      <Seccion etiqueta="Tu estimación" titulo="Cambia los números." destacado="El resultado se actualiza solo.">
        <Calculadora />
      </Seccion>

      <Preguntas items={PREGUNTAS} />

      <CtaFinal titulo="¿Te salen las cuentas?" destacado="Hablemos de tu caso." origen="/calculadora" />
    </main>
  );
}

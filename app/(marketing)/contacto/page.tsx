import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioContacto } from "@/components/landing/formulario-contacto";
import { cuerpo, entradilla, titularPagina } from "@/components/landing/estilos";
import { MARCA } from "@/lib/marca";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Solicitar una demo",
  description: `Cuéntanos cómo captas leads y te enseñamos ${MARCA.nombre} con un caso como el tuyo: el agente llamando, conversando y agendando en tu calendario.`,
  alternates: { canonical: "/contacto" },
};

const PASOS = [
  ["Nos cuentas tu caso", "Qué vendes, de dónde vienen tus leads y qué cita quieres conseguir."],
  ["Lo ves funcionar", "Preparamos una demo con un guion parecido al tuyo y escuchas una llamada completa, de principio a fin."],
  ["Decides con números", "Te proponemos un plan según tu volumen de minutos y llamadas simultáneas. Sin compromiso."],
];

export default function ContactoPage() {
  return (
    <main className="bg-white">
      <section className="relative -mt-[4.5rem] px-6 pt-36 pb-24 sm:pt-44 lg:pb-32">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h1 className={titularPagina}>Hablemos de tus leads.</h1>
            <p className={cn(entradilla, "mt-7 max-w-lg")}>
              Déjanos tus datos y preparamos una demo con un caso como el tuyo: el agente llamando, resolviendo dudas y
              reservando la cita en tu calendario.
            </p>
            <h2 className="mt-14 text-[20px] font-semibold">Qué pasa después</h2>
            <ol className="mt-5 flex max-w-lg flex-col gap-6">
              {PASOS.map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[2.25rem_1fr] gap-3">
                  <span className="text-[25px] leading-none font-semibold text-marca-600 tabular-nums [font-stretch:86%]">{i + 1}</span>
                  <div>
                    <h3 className="text-[18px] font-semibold">{t}</h3>
                    <p className={cn(cuerpo, "mt-1")}>{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-10 text-[16px] text-ceniza">
              ¿Prefieres escribirnos?{" "}
              <a href={`mailto:${MARCA.email}`} className="text-carbon underline underline-offset-4 hover:text-marca-700">
                {MARCA.email}
              </a>
            </p>
          </div>
          <div className="relative">
            <Suspense fallback={<div className="h-[38rem] rounded-[1.75rem] border border-carbon/15" />}>
              <FormularioContacto />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}

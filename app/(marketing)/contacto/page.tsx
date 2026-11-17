import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioContacto } from "@/components/landing/formulario-contacto";
import { etiqueta, titular } from "@/components/landing/estilos";
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
    <main className="bg-white text-neutral-950">
      <section className="relative -mt-[4.5rem] px-6 pt-36 pb-24 sm:pt-44 lg:pb-32">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <p className={cn(etiqueta, "text-marca-600")}>Contacto</p>
            <h1 className={cn(titular, "mt-6 text-[clamp(2.5rem,5.2vw,4.5rem)] leading-[0.98]")}>
              Hablemos de tus leads.{" "}
              <span className="bg-linear-to-r from-marca-700 to-marca-500 bg-clip-text text-transparent">
                Te enseñamos cómo llamarlos hoy.
              </span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-neutral-600">
              Déjanos tus datos y preparamos una demo con un caso como el tuyo: el agente llamando, resolviendo dudas y
              reservando la cita en tu calendario.
            </p>
            <ol className="mt-12 flex max-w-lg flex-col">
              {PASOS.map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[3.5rem_1fr] gap-3 border-t border-neutral-200 py-6">
                  <span className="text-3xl tracking-[-0.05em] text-marca-200 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h2 className="text-lg tracking-[-0.02em]">{t}</h2>
                    <p className="mt-1 leading-relaxed text-neutral-600">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-neutral-500">
              ¿Prefieres escribirnos?{" "}
              <a href={`mailto:${MARCA.email}`} className="text-neutral-950 underline underline-offset-4 hover:text-marca-700">
                {MARCA.email}
              </a>
            </p>
          </div>
          <div className="relative">
            <Suspense fallback={<div className="h-[38rem] rounded-3xl border border-neutral-200" />}>
              <FormularioContacto />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}

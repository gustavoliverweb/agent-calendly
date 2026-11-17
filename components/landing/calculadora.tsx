"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { botonClaro } from "@/components/landing/estilos";
import { calcular, SUPUESTOS_EJEMPLO, type Supuestos } from "@/lib/contenido/calculadora";
import { cn } from "@/lib/utils";

type CampoNumerico = Exclude<keyof Supuestos, "precioMinuto">;

const CAMPOS: { campo: CampoNumerico; etiqueta: string; ayuda: string; min: number; max: number; paso: number; unidad: string; rango?: boolean }[] = [
  { campo: "leads", etiqueta: "Leads al mes", ayuda: "Contactos nuevos que quieres llamar cada mes.", min: 0, max: 5000, paso: 10, unidad: "" },
  { campo: "contestan", etiqueta: "Contestan", ayuda: "Cuántos acaban cogiendo el teléfono, contando los reintentos.", min: 0, max: 100, paso: 1, unidad: "%", rango: true },
  { campo: "agendan", etiqueta: "Reservan cita", ayuda: "De los que contestan, cuántos reservan.", min: 0, max: 100, paso: 1, unidad: "%", rango: true },
  { campo: "cierran", etiqueta: "Se hacen clientes", ayuda: "De las citas, cuántas acaban en venta.", min: 0, max: 100, paso: 1, unidad: "%", rango: true },
  { campo: "valorCliente", etiqueta: "Ingreso por cliente", ayuda: "Lo que te deja de media un cliente nuevo.", min: 0, max: 100000, paso: 10, unidad: "€" },
  { campo: "minutosLlamada", etiqueta: "Duración de una llamada", ayuda: "Minutos de media de una llamada contestada.", min: 0, max: 30, paso: 0.5, unidad: "min" },
];

const entero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eurosCent = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

/** Número desde un input: acepta coma decimal; vacío o inválido → null. */
function leerNumero(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function Calculadora() {
  const id = useId();
  const [s, setS] = useState<Supuestos>(SUPUESTOS_EJEMPLO);
  const [precioTexto, setPrecioTexto] = useState("");
  const r = calcular(s);

  const cambiar = (campo: CampoNumerico, texto: string) => setS((p) => ({ ...p, [campo]: leerNumero(texto) ?? 0 }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <form aria-label="Tus números" className="rounded-[1.75rem] border border-carbon/15 p-6 sm:p-9" onSubmit={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-7">
          {CAMPOS.map((c) => (
            <div key={c.campo}>
              <div className="flex items-baseline justify-between gap-4">
                <label htmlFor={`${id}-${c.campo}`} className="text-[17px] font-medium">
                  {c.etiqueta}
                </label>
                <span className="flex items-center gap-1.5">
                  <input
                    id={`${id}-${c.campo}`}
                    type="number"
                    inputMode="decimal"
                    min={c.min}
                    max={c.max}
                    step={c.paso}
                    value={s[c.campo]}
                    onChange={(e) => cambiar(c.campo, e.target.value)}
                    className="h-10 w-24 rounded-xl border border-carbon/25 px-3 text-right text-[17px] tabular-nums outline-none focus:border-marca-600 focus:ring-2 focus:ring-marca-100"
                  />
                  {c.unidad && <span className="w-7 text-[15px] text-ceniza">{c.unidad}</span>}
                </span>
              </div>
              {c.rango && (
                <input
                  type="range"
                  aria-label={c.etiqueta}
                  min={c.min}
                  max={c.max}
                  step={c.paso}
                  value={s[c.campo]}
                  onChange={(e) => cambiar(c.campo, e.target.value)}
                  className="mt-3 w-full accent-marca-600"
                />
              )}
              <p className="mt-1.5 text-[15px] text-ceniza">{c.ayuda}</p>
            </div>
          ))}
          <div className="border-t border-carbon/10 pt-7">
            <div className="flex items-baseline justify-between gap-4">
              <label htmlFor={`${id}-precio`} className="text-[17px] font-medium">
                Precio por minuto <span className="font-normal text-ceniza">(opcional)</span>
              </label>
              <span className="flex items-center gap-1.5">
                <input
                  id={`${id}-precio`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={precioTexto}
                  onChange={(e) => {
                    setPrecioTexto(e.target.value);
                    setS((p) => ({ ...p, precioMinuto: leerNumero(e.target.value) }));
                  }}
                  className="h-10 w-24 rounded-xl border border-carbon/25 px-3 text-right text-[17px] tabular-nums outline-none focus:border-marca-600 focus:ring-2 focus:ring-marca-100"
                />
                <span className="w-7 text-[15px] text-ceniza">€</span>
              </span>
            </div>
            <p className="mt-1.5 text-[15px] text-ceniza">
              Depende de tu plan y tu volumen. Si ya tienes una propuesta, ponlo aquí para ver el retorno.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setS(SUPUESTOS_EJEMPLO);
            setPrecioTexto("");
          }}
          className="mt-8 text-[15px] text-ceniza underline underline-offset-4 hover:text-carbon"
        >
          Volver al ejemplo
        </button>
      </form>

      <div data-tema="oscuro" className="flex flex-col rounded-[1.75rem] bg-tinta-950 p-6 text-white sm:p-9 lg:sticky lg:top-24 lg:self-start">
        <p aria-live="polite">
          <span className="block text-[clamp(4rem,9vw,6rem)] leading-[0.9] font-semibold tracking-[-0.04em] tabular-nums [font-stretch:86%]">
            {entero.format(r.citas)}
          </span>
          <span className="mt-2 block text-[17px] text-white/70">
            {r.citas === 1 ? "cita" : "citas"} al mes, aproximadamente
          </span>
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/15 pt-6">
          {[
            ["Llamadas contestadas", entero.format(r.contestadas)],
            ["Clientes nuevos", entero.format(r.clientes)],
            ["Ingresos posibles", euros.format(r.ingresos)],
            ["Horas de conversación", decimal.format(r.horas)],
            ["Coste estimado", r.coste == null ? "—" : eurosCent.format(r.coste)],
            ["Coste por cita", r.costePorCita == null ? "—" : eurosCent.format(r.costePorCita)],
          ].map(([t, v]) => (
            <div key={t}>
              <dt className="text-[15px] text-white/60">{t}</dt>
              <dd className="mt-0.5 text-[25px] font-semibold tracking-[-0.02em] tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-7 text-[16px] leading-relaxed text-white/70">
          {r.retorno == null
            ? "Añade el precio por minuto para ver cuántas veces recuperas lo invertido."
            : `Por cada euro en minutos de conversación, ${decimal.format(r.retorno)} € en ingresos posibles.`}{" "}
          Son {entero.format(r.minutos)} minutos de conversación que tu equipo no tiene que pasar al teléfono.
        </p>
        <Link href="/contacto?origen=/calculadora" className={cn(botonClaro, "mt-8 self-start")}>
          Revisar mis números con vosotros
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { botonPrincipal, etiqueta } from "@/components/landing/estilos";
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
      <form className="rounded-3xl border border-neutral-200 p-7 sm:p-9" onSubmit={(e) => e.preventDefault()}>
        <p className={cn(etiqueta, "text-marca-600")}>Tus números</p>
        <div className="mt-7 flex flex-col gap-7">
          {CAMPOS.map((c) => (
            <div key={c.campo}>
              <div className="flex items-baseline justify-between gap-4">
                <label htmlFor={`${id}-${c.campo}`} className="text-[15px] text-neutral-950">
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
                    className="h-10 w-24 rounded-xl border border-neutral-300 px-3 text-right tabular-nums outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
                  />
                  {c.unidad && <span className="w-7 text-sm text-neutral-500">{c.unidad}</span>}
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
              <p className="mt-1.5 text-sm text-neutral-500">{c.ayuda}</p>
            </div>
          ))}
          <div className="border-t border-neutral-200 pt-7">
            <div className="flex items-baseline justify-between gap-4">
              <label htmlFor={`${id}-precio`} className="text-[15px] text-neutral-950">
                Precio por minuto <span className="text-neutral-500">(opcional)</span>
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
                  className="h-10 w-24 rounded-xl border border-neutral-300 px-3 text-right tabular-nums outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
                />
                <span className="w-7 text-sm text-neutral-500">€</span>
              </span>
            </div>
            <p className="mt-1.5 text-sm text-neutral-500">
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
          className="mt-8 text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-950"
        >
          Volver al ejemplo
        </button>
      </form>

      <div data-tema="oscuro" className="flex flex-col rounded-3xl bg-tinta-950 p-7 text-white sm:p-9 lg:sticky lg:top-24 lg:self-start">
        <p className={cn(etiqueta, "text-marca-400")}>Cada mes, aproximadamente</p>
        <div className="mt-7" aria-live="polite">
          <p className="text-[clamp(3rem,7vw,4.5rem)] leading-none tracking-[-0.05em] tabular-nums">{entero.format(r.citas)}</p>
          <p className="mt-2 text-white/60">citas agendadas</p>
        </div>
        <dl className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {[
            ["Llamadas contestadas", entero.format(r.contestadas)],
            ["Clientes nuevos", entero.format(r.clientes)],
            ["Ingresos posibles", euros.format(r.ingresos)],
            ["Horas de conversación", decimal.format(r.horas)],
            ["Coste estimado", r.coste == null ? "—" : eurosCent.format(r.coste)],
            ["Coste por cita", r.costePorCita == null ? "—" : eurosCent.format(r.costePorCita)],
          ].map(([t, v]) => (
            <div key={t} className="bg-tinta-950 p-5">
              <dt className="text-sm text-white/50">{t}</dt>
              <dd className="mt-1.5 text-2xl tracking-[-0.03em] tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm leading-relaxed text-white/50">
          {r.retorno == null
            ? "Añade el precio por minuto para ver cuántas veces recuperas lo invertido."
            : `Por cada euro en minutos de conversación, ${decimal.format(r.retorno)} € en ingresos posibles.`}{" "}
          Son {entero.format(r.minutos)} minutos de conversación que tu equipo no tiene que pasar al teléfono.
        </p>
        <Link href="/contacto?origen=/calculadora" className={cn(botonPrincipal, "mt-8 self-start")}>
          Revisar mis números <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </div>
  );
}

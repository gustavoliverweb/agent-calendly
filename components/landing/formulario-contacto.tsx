"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { enviarSolicitud, type EnvioState } from "@/app/(marketing)/contacto/actions";
import { botonPrincipal } from "@/components/landing/estilos";
import { SECTORES, VOLUMENES } from "@/lib/contenido/contacto";
import { cn } from "@/lib/utils";

const campo =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-[15px] text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-marca-600 focus:ring-2 focus:ring-marca-100";
const etiquetaCampo = "text-sm text-neutral-700";

/** Formulario de «Solicitar una demo». Lee ?origen= y ?sector= de la URL: renderizar dentro de <Suspense>. */
export function FormularioContacto() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<EnvioState, FormData>(enviarSolicitud, {});
  const origen = params.get("origen") ?? "";
  const sectorInicial = params.get("sector") ?? "";

  if (state.ok) {
    return (
      <div role="status" className="rounded-3xl border border-neutral-200 p-8">
        <span className="flex size-11 items-center justify-center rounded-full bg-marca-50 text-marca-600">
          <CheckIcon className="size-5" />
        </span>
        <h2 className="mt-6 text-3xl tracking-[-0.03em]">Solicitud recibida.</h2>
        <p className="mt-3 leading-relaxed text-neutral-600">
          Gracias. Te escribiremos o te llamaremos para preparar la demo con un caso como el tuyo.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline underline-offset-4 hover:text-marca-700">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <form
      // Envío manual: si hay un error, no se borra lo escrito.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-5 rounded-3xl border border-neutral-200 p-6 sm:p-8"
      noValidate
    >
      <input type="hidden" name="origen" value={origen} />
      {/* Trampa para bots: fuera de la vista y del tabulador. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Web <input type="text" name="web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={etiquetaCampo}>Nombre *</span>
          <input name="nombre" required maxLength={120} autoComplete="name" className={campo} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={etiquetaCampo}>Email de trabajo *</span>
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={campo} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={etiquetaCampo}>Empresa</span>
          <input name="empresa" maxLength={200} autoComplete="organization" className={campo} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={etiquetaCampo}>Teléfono</span>
          <input name="telefono" type="tel" maxLength={40} autoComplete="tel" className={campo} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={etiquetaCampo}>Sector</span>
          <select name="sector" defaultValue={(SECTORES as readonly string[]).includes(sectorInicial) ? sectorInicial : ""} className={campo}>
            <option value="">Elige uno</option>
            {SECTORES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className={etiquetaCampo}>Leads o contactos al mes</span>
          <select name="volumen" defaultValue="" className={campo}>
            <option value="">Elige un rango</option>
            {VOLUMENES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className={etiquetaCampo}>¿Qué te gustaría conseguir?</span>
        <textarea
          name="mensaje"
          rows={4}
          maxLength={3000}
          placeholder="Por ejemplo: llamar a los leads del formulario web en menos de cinco minutos y darles cita."
          className={cn(campo, "h-auto py-3")}
        />
      </label>

      <label className="flex items-start gap-3 text-sm text-neutral-600">
        <input type="checkbox" name="privacidad" required className="mt-0.5 size-4 accent-marca-600" />
        <span>
          He leído la{" "}
          <Link href="/privacidad" className="underline underline-offset-4 hover:text-marca-700" target="_blank">
            política de privacidad
          </Link>
          . Usaremos tus datos solo para responderte.
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl bg-marca-50 px-4 py-3 text-sm text-marca-800">
          {state.error}
        </p>
      )}

      <div>
        <button type="submit" disabled={pending} className={cn(botonPrincipal, "disabled:opacity-60")}>
          {pending ? "Enviando…" : "Solicitar una demo"} {!pending && <ArrowRightIcon className="size-4" />}
        </button>
      </div>
    </form>
  );
}

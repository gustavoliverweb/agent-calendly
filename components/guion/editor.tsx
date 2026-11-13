"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2Icon, HistoryIcon } from "lucide-react";
import { toast } from "sonner";
import { activarGuion, guardarGuion } from "@/app/(panel)/app/guion/actions";
import { PruebaNavegador, type ContactoPrueba } from "@/components/guion/prueba-navegador";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  APARTADOS,
  MARCADORES,
  MAX_TEXTO,
  VOCES,
  montarGuion,
  problemasPrimerMensaje,
  renderPrimerMensaje,
  type CampoApartado,
  type GuionForm,
} from "@/lib/guion/guion";
import { cn } from "@/lib/utils";

export type VersionGuion = GuionForm & { id: string; version: number; creado_en: string; texto: string };

const AYUDAS: Record<CampoApartado, string> = {
  negocio: "Qué hace la empresa, en una o dos frases.",
  motivo: "Por qué se llama a esta persona y, si pregunta, de dónde tenemos su número.",
  oferta: "Qué se le propone. Es lo que el agente explica en una frase.",
  cita: "Dónde o cómo es la cita (presencial, videollamada…), cuánto dura y qué conviene saber.",
  preguntas: "Una por línea: «¿Pregunta? Respuesta». Lo que no esté aquí, el agente no lo inventa.",
  objeciones: "Respuestas a objeciones típicas de tu sector. Las generales (no me interesa, no me llaméis) ya están cubiertas.",
  limites: "Temas que debe evitar: precios, plazos, promesas…",
};

const VACIO: GuionForm = {
  negocio_nombre: "",
  nombre_agente: "",
  primer_mensaje:
    "Hola, ¿hablo con {nombre}? Le llamo de {negocio}. Soy {agente}, una asistente virtual con inteligencia artificial, y esta llamada se transcribe para gestionar su cita.",
  voz_id: null,
  negocio: "",
  motivo: "",
  oferta: "",
  cita: "",
  preguntas: "",
  objeciones: "",
  limites: "",
};

const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" });

function aFormulario(v: VersionGuion): GuionForm {
  return {
    negocio_nombre: v.negocio_nombre,
    nombre_agente: v.nombre_agente,
    primer_mensaje: v.primer_mensaje,
    voz_id: v.voz_id,
    negocio: v.negocio,
    motivo: v.motivo,
    oferta: v.oferta,
    cita: v.cita,
    preguntas: v.preguntas,
    objeciones: v.objeciones,
    limites: v.limites,
  };
}

export function EditorGuion({
  versiones,
  activoId,
  puedeEditar,
  contactos,
  pruebaDisponible,
}: {
  versiones: VersionGuion[];
  activoId: string | null;
  puedeEditar: boolean;
  contactos: ContactoPrueba[];
  pruebaDisponible: boolean;
}) {
  const inicial = versiones.find((v) => v.id === activoId) ?? versiones[0];
  const [baseId, setBaseId] = useState<string | null>(inicial?.id ?? null);
  const [form, setForm] = useState<GuionForm>(inicial ? aFormulario(inicial) : VACIO);
  const [pending, startTransition] = useTransition();

  const base = versiones.find((v) => v.id === baseId);
  const cambiado = JSON.stringify(form) !== JSON.stringify(base ? aFormulario(base) : VACIO);
  const texto = useMemo(() => montarGuion(form), [form]);
  const problemas = useMemo(() => problemasPrimerMensaje(form.primer_mensaje), [form.primer_mensaje]);
  const saludo = renderPrimerMensaje(form.primer_mensaje, {
    nombre: "Laura",
    negocio: form.negocio_nombre || "{negocio}",
    agente: form.nombre_agente || "{agente}",
  });

  const set = <K extends keyof GuionForm>(k: K, valor: GuionForm[K]) => setForm((f) => ({ ...f, [k]: valor }));

  function cargar(v: VersionGuion) {
    if (cambiado && !window.confirm("Hay cambios sin guardar en el formulario. ¿Descartarlos?")) return;
    setBaseId(v.id);
    setForm(aFormulario(v));
  }

  function guardar(activar: boolean) {
    startTransition(async () => {
      const r = await guardarGuion(form, activar);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.guionId) setBaseId(r.guionId);
      toast.success(activar ? `Versión ${r.version} guardada y activa` : `Versión ${r.version} guardada (sin activar)`);
    });
  }

  function activar(id: string, version: number) {
    startTransition(async () => {
      const r = await activarGuion(id);
      if (r.error) toast.error(r.error);
      else toast.success(`Versión ${version} activa: la usarán las próximas llamadas`);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <form
        className="flex min-w-0 flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          guardar(true);
        }}
      >
        {!puedeEditar && (
          <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
            Solo el propietario de la empresa puede cambiar el guion. Puedes consultarlo y probarlo.
          </p>
        )}
        {base && (
          <p className="text-xs text-muted-foreground">
            Editando a partir de la versión {base.version}
            {base.id === activoId ? " (activa)" : ""}. Al guardar se crea una versión nueva.
          </p>
        )}

        <fieldset disabled={!puedeEditar || pending} className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Presentación</CardTitle>
              <CardDescription>Cómo se presenta el agente al empezar la llamada.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="negocio_nombre" label="Nombre del negocio" ayuda="Tal como lo dirá el agente.">
                  <Input
                    id="negocio_nombre"
                    value={form.negocio_nombre}
                    maxLength={80}
                    onChange={(e) => set("negocio_nombre", e.target.value)}
                  />
                </Campo>
                <Campo id="nombre_agente" label="Nombre del agente" ayuda="P. ej. Clara.">
                  <Input
                    id="nombre_agente"
                    value={form.nombre_agente}
                    maxLength={40}
                    onChange={(e) => set("nombre_agente", e.target.value)}
                  />
                </Campo>
              </div>

              <Campo
                id="primer_mensaje"
                label="Primer mensaje"
                ayuda={`Debe decir que es una asistente virtual (IA) y que la llamada se transcribe. Marcadores: ${Object.entries(
                  MARCADORES,
                )
                  .map(([k, v]) => `{${k}} = ${v}`)
                  .join(", ")}.`}
              >
                <Textarea
                  id="primer_mensaje"
                  rows={3}
                  maxLength={400}
                  value={form.primer_mensaje}
                  onChange={(e) => set("primer_mensaje", e.target.value)}
                  aria-invalid={problemas.length > 0}
                />
              </Campo>
              {problemas.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-destructive">
                  {problemas.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg bg-muted/60 p-3 text-sm">
                  <span className="text-muted-foreground">Así sonaría si llamara a Laura: </span>
                  {saludo}
                </p>
              )}

              <Campo id="voz" label="Voz" ayuda="Pronto habrá más voces en castellano para elegir.">
                <select
                  id="voz"
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm sm:w-72"
                  value={form.voz_id ?? ""}
                  onChange={(e) => set("voz_id", e.target.value || null)}
                >
                  {VOCES.map((v) => (
                    <option key={v.id ?? ""} value={v.id ?? ""}>
                      {v.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tu negocio</CardTitle>
              <CardDescription>
                Lo que el agente sabe para hablar de tu negocio. Escribe frases cortas y claras: lo que no esté aquí, no lo
                dirá.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {APARTADOS.map((a) => (
                <Campo
                  key={a.campo}
                  id={a.campo}
                  label={`${a.titulo}${a.obligatorio ? "" : " (opcional)"}`}
                  ayuda={AYUDAS[a.campo]}
                  contador={`${form[a.campo].length}/${a.max}`}
                >
                  <Textarea
                    id={a.campo}
                    rows={a.max > 1500 ? 6 : 3}
                    maxLength={a.max}
                    value={form[a.campo]}
                    onChange={(e) => set(a.campo, e.target.value)}
                  />
                </Campo>
              ))}
            </CardContent>
          </Card>

          {puedeEditar && (
            <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t bg-background py-3">
              <Button type="submit" disabled={pending || problemas.length > 0 || (!cambiado && base?.id === activoId)}>
                {pending ? "Guardando…" : "Guardar y activar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending || problemas.length > 0 || !cambiado}
                onClick={() => guardar(false)}
              >
                Guardar sin activar
              </Button>
              <span className="text-xs text-muted-foreground">
                {cambiado ? "Hay cambios sin guardar." : "Sin cambios."} Guardar sin activar sirve para probar antes una
                versión.
              </span>
            </div>
          )}
        </fieldset>
      </form>

      <div className="flex min-w-0 flex-col gap-6">
        <PruebaNavegador
          versiones={versiones.map((v) => ({ id: v.id, version: v.version, activa: v.id === activoId }))}
          versionInicial={baseId}
          contactos={contactos}
          disponible={pruebaDisponible}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="size-4" /> Versiones
            </CardTitle>
            <CardDescription>Cada llamada guarda la versión con la que se hizo.</CardDescription>
          </CardHeader>
          <CardContent>
            {versiones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay ninguna versión guardada.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {versiones.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">v{v.version}</span>
                      <span className="text-muted-foreground">{fecha.format(new Date(v.creado_en))}</span>
                      {v.id === activoId && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2Icon className="size-3" /> Activa
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={v.id === baseId && !cambiado}
                        onClick={() => cargar(v)}
                      >
                        {v.id === baseId ? "En el formulario" : "Ver"}
                      </Button>
                      {puedeEditar && v.id !== activoId && (
                        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => activar(v.id, v.version)}>
                          Activar
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Texto que recibe el agente</CardTitle>
            <CardDescription>
              Se añade al guion común (tono, uso del calendario, reglas legales).{" "}
              <span className={cn(texto.length > MAX_TEXTO && "font-medium text-destructive")}>
                {texto.length}/{MAX_TEXTO} caracteres.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted/60 p-3 text-xs whitespace-pre-wrap">{texto}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Campo({
  id,
  label,
  ayuda,
  contador,
  children,
}: {
  id: string;
  label: string;
  ayuda?: string;
  contador?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {contador && <span className="text-xs text-muted-foreground tabular-nums">{contador}</span>}
      </div>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

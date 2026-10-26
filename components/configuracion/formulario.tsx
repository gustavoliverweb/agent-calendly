"use client";

import { useState, useTransition } from "react";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardarConfiguracion } from "@/app/(panel)/configuracion/actions";
import type { ConfiguracionForm } from "@/lib/calls/config-form";
import type { Franja } from "@/lib/calls/window";
import { cn } from "@/lib/utils";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

type Valores = Omit<ConfiguracionForm, "franjas" | "festivos"> & { franjas: Franja[]; festivos: string[] };

const fechaLarga = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function FormularioConfiguracion({ inicial }: { inicial: Valores }) {
  const [v, setV] = useState<Valores>(inicial);
  const [festivo, setFestivo] = useState("");
  const [pending, startTransition] = useTransition();
  const cambiado = JSON.stringify(v) !== JSON.stringify(inicial);

  const set = <K extends keyof Valores>(k: K, valor: Valores[K]) => setV((prev) => ({ ...prev, [k]: valor }));
  const setFranja = (i: number, cambio: Partial<Franja>) =>
    set("franjas", v.franjas.map((f, j) => (j === i ? { ...f, ...cambio } : f)));

  function toggleDia(i: number, dia: number) {
    const dias = v.franjas[i].dias;
    setFranja(i, { dias: dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia].sort() });
  }

  function anadirFestivo() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(festivo)) return;
    set("festivos", [...new Set([...v.festivos, festivo])].sort());
    setFestivo("");
  }

  function guardar() {
    startTransition(async () => {
      const r = await guardarConfiguracion(v);
      if (r.error) toast.error(r.error);
      else toast.success("Configuración guardada");
    });
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Franjas horarias</CardTitle>
          <CardDescription>
            Hora de Madrid. Fuera de estas franjas (y en festivos) no se lanza ninguna llamada, tampoco desde la ficha.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {v.franjas.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="flex gap-1" role="group" aria-label={`Días de la franja ${i + 1}`}>
                {DIAS.map((d, j) => {
                  const activo = f.dias.includes(j + 1);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={activo}
                      aria-label={DIAS_LARGOS[j]}
                      onClick={() => toggleDia(i, j + 1)}
                      className={cn(
                        "size-8 rounded-md border text-xs font-medium transition-colors",
                        activo ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Input
                  type="time"
                  className="w-28"
                  value={f.desde}
                  onChange={(e) => setFranja(i, { desde: e.target.value })}
                  aria-label="Desde"
                  required
                />
                <span className="text-muted-foreground">a</span>
                <Input
                  type="time"
                  className="w-28"
                  value={f.hasta}
                  onChange={(e) => setFranja(i, { hasta: e.target.value })}
                  aria-label="Hasta"
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label="Quitar franja"
                disabled={v.franjas.length === 1}
                onClick={() => set("franjas", v.franjas.filter((_, j) => j !== i))}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set("franjas", [...v.franjas, { dias: [1, 2, 3, 4, 5], desde: "10:00", hasta: "14:00" }])}
            >
              <PlusIcon data-icon="inline-start" />
              Añadir franja
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Festivos</CardTitle>
          <CardDescription>Días completos sin llamadas (nacionales, autonómicos o locales).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              className="w-44"
              value={festivo}
              onChange={(e) => setFestivo(e.target.value)}
              aria-label="Fecha del festivo"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  anadirFestivo();
                }
              }}
            />
            <Button type="button" variant="outline" disabled={!festivo} onClick={anadirFestivo}>
              <PlusIcon data-icon="inline-start" />
              Añadir
            </Button>
          </div>
          {v.festivos.length ? (
            <ul className="flex flex-wrap gap-2">
              {v.festivos.map((f) => (
                <li key={f} className="flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-sm">
                  {fechaLarga.format(new Date(`${f}T00:00:00Z`))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Quitar ${f}`}
                    onClick={() => set("festivos", v.festivos.filter((x) => x !== f))}
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ningún festivo configurado.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Llamadas y reintentos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Campo
            id="max_concurrencia"
            label="Llamadas simultáneas (máx.)"
            ayuda="No superes el límite de llamadas simultáneas de tu plan de ElevenLabs: por encima se cobra tarifa “burst”."
          >
            <Input
              id="max_concurrencia"
              type="number"
              min={1}
              max={10}
              value={v.max_concurrencia as number}
              onChange={(e) => set("max_concurrencia", e.target.valueAsNumber)}
              required
            />
          </Campo>
          <Campo
            id="timeout_llamada_min"
            label="Dar una llamada por perdida tras (min)"
            ayuda="Si no llega el aviso de fin de llamada, se consulta a ElevenLabs y se cierra."
          >
            <Input
              id="timeout_llamada_min"
              type="number"
              min={5}
              max={120}
              value={v.timeout_llamada_min as number}
              onChange={(e) => set("timeout_llamada_min", e.target.valueAsNumber)}
              required
            />
          </Campo>
          <Campo
            id="max_reintentos"
            label="Reintentos si no contesta"
            ayuda={`Además del primer intento: con ${String(v.max_reintentos)} se llama hasta ${Number(v.max_reintentos) + 1} veces.`}
          >
            <Input
              id="max_reintentos"
              type="number"
              min={0}
              max={10}
              value={v.max_reintentos as number}
              onChange={(e) => set("max_reintentos", e.target.valueAsNumber)}
              required
            />
          </Campo>
          <Campo
            id="horas_entre_reintentos"
            label="Horas entre reintentos"
            ayuda="Se ajusta al siguiente inicio de franja si cae fuera de horario."
          >
            <Input
              id="horas_entre_reintentos"
              type="number"
              min={1}
              max={720}
              value={v.horas_entre_reintentos as number}
              onChange={(e) => set("horas_entre_reintentos", e.target.valueAsNumber)}
              required
            />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tipo de campaña</CardTitle>
          <CardDescription>Decisión legal: cambiarla afecta a quién se puede llamar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de campaña">
          {(
            [
              ["comercial", "Comercial", "Solo se llama a contactos con consentimiento registrado."],
              ["no_comercial", "No comercial", "Relación previa con el contacto (p. ej. clientes). No exige consentimiento."],
            ] as const
          ).map(([valor, titulo, texto]) => (
            <label
              key={valor}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors",
                v.tipo_campana === valor ? "border-primary bg-muted/50" : "hover:bg-muted/30",
              )}
            >
              <input
                type="radio"
                name="tipo_campana"
                className="mt-0.5 accent-primary"
                checked={v.tipo_campana === valor}
                onChange={() => set("tipo_campana", valor)}
              />
              <span>
                <span className="font-medium">{titulo}</span>
                <span className="mt-0.5 block text-muted-foreground">{texto}</span>
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
        {cambiado && <span className="mr-auto text-sm text-muted-foreground">Hay cambios sin guardar</span>}
        <Button type="button" variant="ghost" disabled={!cambiado || pending} onClick={() => setV(inicial)}>
          Descartar
        </Button>
        <Button type="submit" disabled={!cambiado || pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function Campo({ id, label, ayuda, children }: { id: string; label: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

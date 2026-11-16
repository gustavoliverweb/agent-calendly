"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarConcurrenciaGlobal, guardarLineaYLimites } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type NumeroDisponible = { phoneNumberId: string; numero: string; etiqueta: string | null; asignadoA: string | null };

const SELECT = "h-9 w-full rounded-lg border bg-background px-3 text-sm";

/** Ficha de empresa en /admin: línea asignada y límites contratados. */
export function LineaLimites({
  empresaId,
  inicial,
  numeros,
  minutosMes,
}: {
  empresaId: string;
  inicial: { phoneNumberId: string | null; telefonoNumero: string | null; limiteMinutos: number | null; maxConcurrencia: number };
  /** Null: no se pudo leer la lista de ElevenLabs (se escribe el id a mano). */
  numeros: NumeroDisponible[] | null;
  minutosMes: number;
}) {
  const [phoneNumberId, setPhoneNumberId] = useState(inicial.phoneNumberId ?? "");
  const [telefonoNumero, setTelefonoNumero] = useState(inicial.telefonoNumero ?? "");
  const [limite, setLimite] = useState(inicial.limiteMinutos?.toString() ?? "");
  const [concurrencia, setConcurrencia] = useState(inicial.maxConcurrencia.toString());
  const [pending, startTransition] = useTransition();

  function elegirNumero(id: string) {
    setPhoneNumberId(id);
    setTelefonoNumero(numeros?.find((n) => n.phoneNumberId === id)?.numero ?? "");
  }

  function guardar() {
    startTransition(async () => {
      const r = await guardarLineaYLimites({
        empresaId,
        phoneNumberId,
        telefonoNumero,
        limiteMinutos: limite.trim() ? Number(limite) : null,
        maxConcurrencia: Number(concurrencia),
      });
      if (r.error) toast.error(r.error);
      else toast.success("Línea y límites guardados");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Línea y límites</CardTitle>
        <CardDescription>
          La línea es el número SIP de la empresa importado en ElevenLabs (Phone numbers). Sin línea, la empresa puede
          preparar todo y probar en el navegador, pero no llamar por teléfono.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="linea">Línea</Label>
              {numeros ? (
                <select id="linea" className={SELECT} value={phoneNumberId} onChange={(e) => elegirNumero(e.target.value)}>
                  <option value="">Sin línea</option>
                  {numeros.map((n) => (
                    <option key={n.phoneNumberId} value={n.phoneNumberId} disabled={Boolean(n.asignadoA)}>
                      {n.numero}
                      {n.etiqueta ? ` · ${n.etiqueta}` : ""}
                      {n.asignadoA ? ` (asignado a ${n.asignadoA})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <Input
                    id="linea"
                    placeholder="phone_number_id de ElevenLabs"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                  />
                  <Input
                    aria-label="Número de teléfono"
                    placeholder="Número, p. ej. +34910000000"
                    value={telefonoNumero}
                    onChange={(e) => setTelefonoNumero(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">No se ha podido leer la lista de números de ElevenLabs.</p>
                </>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="concurrencia">Llamadas simultáneas contratadas</Label>
              <Input
                id="concurrencia"
                type="number"
                min={1}
                max={50}
                value={concurrencia}
                onChange={(e) => setConcurrencia(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">La empresa puede configurar menos, nunca más.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="limite">Minutos al mes</Label>
              <Input
                id="limite"
                type="number"
                min={1}
                placeholder="Sin límite"
                value={limite}
                onChange={(e) => setLimite(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Este mes lleva {minutosMes.toLocaleString("es-ES")} min. Al llegar al límite no sale ninguna llamada más.
              </p>
            </div>
          </div>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** /admin: conversaciones simultáneas del plan de ElevenLabs, para toda la plataforma. */
export function ConcurrenciaGlobal({ maximo, activas }: { maximo: number; activas: number }) {
  const [valor, setValor] = useState(maximo.toString());
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await guardarConcurrenciaGlobal(Number(valor));
          if (r.error) toast.error(r.error);
          else toast.success("Concurrencia global guardada");
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="global">Llamadas simultáneas de la plataforma</Label>
        <Input id="global" type="number" min={1} max={500} className="w-32" value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <Button type="submit" variant="outline" disabled={pending || Number(valor) === maximo}>
        Guardar
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Las que permite el plan de ElevenLabs, repartidas entre todas las empresas. Ahora hay {activas} en curso.
      </p>
    </form>
  );
}

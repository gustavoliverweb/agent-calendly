"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { anadirDominio, comprobarDominio, quitarDominio } from "@/app/(admin)/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DominioFila = { id: string; dominio: string; estado: string; detalle: string | null; comprobadoEn: string | null };

const ESTADO: Record<string, { texto: string; variante: "secondary" | "outline" | "destructive" }> = {
  verificado: { texto: "Verificado", variante: "secondary" },
  pendiente: { texto: "Pendiente", variante: "outline" },
  error: { texto: "Error", variante: "destructive" },
};

const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

/** Ficha de empresa en /admin: dominios propios (marca blanca). */
export function Dominios({
  empresaId,
  dominios,
  destinoCname,
  renderConfigurado,
  direccion,
}: {
  empresaId: string;
  dominios: DominioFila[];
  /** Host onrender.com del servicio, destino del CNAME. */
  destinoCname: string | null;
  renderConfigurado: boolean;
  /** Dirección con la que entran hoy sus usuarios. */
  direccion: string;
}) {
  const [nuevo, setNuevo] = useState("");
  const [pending, startTransition] = useTransition();

  function anadir() {
    startTransition(async () => {
      const r = await anadirDominio(empresaId, nuevo);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Dominio añadido");
        setNuevo("");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dominios</CardTitle>
        <CardDescription>
          Sus usuarios entran hoy por <span className="font-mono text-foreground">{direccion}</span>. Con un dominio propio
          verificado, el login, el panel y los enlaces de invitación usan ese dominio y su marca.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {dominios.length > 0 && (
          <ul className="flex flex-col divide-y rounded-lg border">
            {dominios.map((d) => {
              const e = ESTADO[d.estado] ?? ESTADO.pendiente;
              return (
                <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-mono">
                      {d.dominio} <Badge variant={e.variante}>{e.texto}</Badge>
                    </p>
                    {d.detalle && <p className="mt-1 text-xs text-muted-foreground">{d.detalle}</p>}
                    {d.comprobadoEn && (
                      <p className="mt-1 text-xs text-muted-foreground">Comprobado: {fecha.format(new Date(d.comprobadoEn))}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await comprobarDominio(d.id);
                          if (r.error) toast.error(r.error);
                          else toast.success(r.estado === "verificado" ? "Dominio verificado" : "Aún no está listo");
                        })
                      }
                    >
                      Comprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`¿Quitar ${d.dominio}? Sus usuarios dejarán de poder entrar por ese dominio.`)) return;
                        startTransition(async () => {
                          const r = await quitarDominio(d.id);
                          if (r.error) toast.error(r.error);
                          else toast.success("Dominio quitado");
                        });
                      }}
                    >
                      Quitar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            anadir();
          }}
        >
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <Label htmlFor="dominio">Nuevo dominio</Label>
            <Input id="dominio" placeholder="llamadas.empresa.com" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
          </div>
          <Button type="submit" disabled={pending || !nuevo.trim()}>
            Añadir
          </Button>
        </form>

        <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Qué tiene que hacer la empresa</p>
          <p className="mt-1">
            Mejor un subdominio (p. ej. <span className="font-mono">llamadas.empresa.com</span>). En su DNS, un registro{" "}
            <span className="font-mono">CNAME</span> de ese subdominio hacia{" "}
            <span className="font-mono text-foreground">{destinoCname ?? "<servicio>.onrender.com (falta RENDER_SERVICE_HOST)"}</span>, sin
            registros AAAA. Un dominio raíz necesita registros A según las instrucciones de Render, y Render añade además el
            www.
          </p>
          <p className="mt-1">
            {renderConfigurado
              ? "El dominio se añade solo al servicio de Render; el certificado HTTPS llega cuando el DNS apunta bien (minutos u horas)."
              : "Sin RENDER_API_KEY: añade también el dominio en Render (servicio → Settings → Custom Domains). «Comprobar» solo mira el DNS."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

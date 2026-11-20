"use client";

import { useEffect, useState, useTransition } from "react";
import { SearchIcon } from "lucide-react";
import { toast } from "sonner";
import {
  anadirVoz,
  buscarVocesElevenLabs,
  cambiarVozActiva,
  editarVoz,
  quitarVoz,
} from "@/app/(admin)/admin/actions";
import type { VozElevenLabs } from "@/lib/elevenlabs/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type VozCatalogo = {
  id: string;
  voiceId: string;
  nombre: string;
  descripcion: string;
  muestra: boolean;
  activa: boolean;
  enUso: number;
};

type Edicion = { id?: string; voiceId: string; nombre: string; descripcion: string };

export function CatalogoVoces({ voces, puedeAnadir }: { voces: VozCatalogo[]; puedeAnadir: boolean }) {
  const [pending, startTransition] = useTransition();
  const [buscando, setBuscando] = useState(false);
  const [edicion, setEdicion] = useState<Edicion | null>(null);

  function ejecutar(fn: () => Promise<{ error?: string }>, ok: string, alTerminar?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else {
        toast.success(ok);
        alTerminar?.();
      }
    });
  }

  function guardar() {
    if (!edicion) return;
    const { id, voiceId, nombre, descripcion } = edicion;
    ejecutar(
      () => (id ? editarVoz(id, nombre, descripcion) : anadirVoz(voiceId, nombre, descripcion)),
      id ? "Voz guardada" : "Voz añadida al catálogo",
      () => setEdicion(null),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Catálogo</h2>
        <Button disabled={!puedeAnadir || pending} onClick={() => setBuscando(true)}>
          Añadir voz
        </Button>
      </div>

      {voces.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            Aún no hay voces en el catálogo: las empresas solo pueden usar la voz por defecto del agente. Añade voces desde tu
            cuenta de ElevenLabs (las tuyas o las que hayas guardado de su biblioteca).
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {voces.map((v) => (
            <li key={v.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{v.nombre}</span>
                  {!v.activa && <Badge variant="outline">Desactivada</Badge>}
                  {v.enUso > 0 && (
                    <Badge variant="secondary">
                      {v.enUso === 1 ? "1 empresa la usa" : `${v.enUso} empresas la usan`}
                    </Badge>
                  )}
                </div>
                {v.descripcion && <p className="text-sm text-muted-foreground">{v.descripcion}</p>}
                <p className="font-mono text-xs text-muted-foreground">{v.voiceId}</p>
              </div>
              {v.muestra && <Muestra voiceId={v.voiceId} nombre={v.nombre} />}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setEdicion({ id: v.id, voiceId: v.voiceId, nombre: v.nombre, descripcion: v.descripcion })}
                >
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    ejecutar(() => cambiarVozActiva(v.id, !v.activa), v.activa ? "Voz desactivada" : "Voz activada")
                  }
                >
                  {v.activa ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={pending}
                  title={v.enUso > 0 ? "En uso: desactívala en lugar de quitarla" : undefined}
                  onClick={() => ejecutar(() => quitarVoz(v.id), "Voz quitada del catálogo")}
                >
                  Quitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Desactivar una voz la quita del selector del guion; las empresas que ya la usan siguen llamando con ella hasta que
        cambien de voz.
      </p>

      <BuscarVoces
        abierto={buscando}
        enCatalogo={new Set(voces.map((v) => v.voiceId))}
        onCerrar={() => setBuscando(false)}
        onElegir={(v) => {
          setBuscando(false);
          setEdicion({ voiceId: v.voiceId, nombre: v.nombre.slice(0, 60), descripcion: descripcionPropuesta(v) });
        }}
      />

      <Dialog open={edicion != null} onOpenChange={(o) => !o && !pending && setEdicion(null)}>
        <DialogContent className="sm:max-w-md">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              guardar();
            }}
          >
            <DialogHeader>
              <DialogTitle>{edicion?.id ? "Editar voz" : "Añadir voz"}</DialogTitle>
              <DialogDescription>Así la verán las empresas en el selector del guion.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="voz-nombre">Nombre</Label>
              <Input
                id="voz-nombre"
                required
                maxLength={60}
                value={edicion?.nombre ?? ""}
                onChange={(e) => setEdicion((d) => d && { ...d, nombre: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="voz-descripcion">Descripción</Label>
              <Input
                id="voz-descripcion"
                maxLength={200}
                placeholder="Mujer, castellano, tono cercano"
                value={edicion?.descripcion ?? ""}
                onChange={(e) => setEdicion((d) => d && { ...d, descripcion: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setEdicion(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ETIQUETAS_ES: Record<string, string> = { female: "mujer", male: "hombre", neutral: "neutra" };

/** Descripción inicial a partir de las etiquetas de ElevenLabs; el proveedor la retoca. */
function descripcionPropuesta(v: VozElevenLabs): string {
  const partes = [
    v.etiquetas.gender ? (ETIQUETAS_ES[v.etiquetas.gender] ?? v.etiquetas.gender) : null,
    v.etiquetas.accent ?? null,
    v.etiquetas.age ?? null,
  ].filter(Boolean);
  return partes.join(", ").slice(0, 200);
}

/** Muestra servida por /admin (pregunta a ElevenLabs, así vale también para voces desactivadas o aún fuera del catálogo). */
function Muestra({ voiceId, nombre }: { voiceId: string; nombre: string }) {
  return (
    <audio
      controls
      preload="none"
      className="h-9 w-full max-w-64"
      src={`/admin/voces/muestra/${encodeURIComponent(voiceId)}`}
      aria-label={`Muestra de la voz ${nombre}`}
    />
  );
}

function BuscarVoces({
  abierto,
  enCatalogo,
  onCerrar,
  onElegir,
}: {
  abierto: boolean;
  enCatalogo: Set<string>;
  onCerrar: () => void;
  onElegir: (v: VozElevenLabs) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [voces, setVoces] = useState<VozElevenLabs[] | null>(null);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buscar(pagina?: string) {
    startTransition(async () => {
      const r = await buscarVocesElevenLabs(busqueda, pagina);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setError(null);
      setVoces((prev) => (pagina && prev ? [...prev, ...r.voces] : r.voces));
      setSiguiente(r.siguiente);
    });
  }

  // La primera vez que se abre, carga la lista sin filtro.
  useEffect(() => {
    if (abierto && voces == null && !pending) buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Voces de tu cuenta de ElevenLabs</DialogTitle>
          <DialogDescription>
            Para ofrecer una voz de la biblioteca de ElevenLabs, guárdala antes en tu cuenta («Add to my voices»).
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
        >
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, acento o descripción"
              className="pl-8"
              aria-label="Buscar voces"
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            Buscar
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="max-h-[55vh] overflow-y-auto">
          {voces == null ? (
            <p className="py-6 text-sm text-muted-foreground">Cargando…</p>
          ) : voces.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No hay voces que coincidan.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {voces.map((v) => {
                const ya = enCatalogo.has(v.voiceId);
                return (
                  <li key={v.voiceId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-medium">{v.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {[v.categoria, ...Object.values(v.etiquetas)].filter(Boolean).join(", ")}
                        {v.idiomas.length ? ` · idiomas: ${v.idiomas.join(", ")}` : ""}
                      </span>
                    </div>
                    {v.muestraUrl && <Muestra voiceId={v.voiceId} nombre={v.nombre} />}
                    <Button size="sm" variant={ya ? "ghost" : "default"} disabled={ya} onClick={() => onElegir(v)}>
                      {ya ? "Ya está" : "Elegir"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {siguiente && (
            <Button variant="outline" className="mt-3 w-full" disabled={pending} onClick={() => buscar(siguiente)}>
              {pending ? "Cargando…" : "Ver más"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoBadge } from "@/components/contactos/estado-badge";
import { EditarContacto } from "@/components/contactos/editar-contacto";
import { ZonaExclusion } from "@/components/contactos/zona-exclusion";
import { BotonLlamar } from "@/components/llamadas/boton-llamar";
import { EstadoLlamada } from "@/components/llamadas/estado-llamada";
import { etiquetaClasificacion, formatearDuracion } from "@/lib/calls/estados";
import { formatPhone } from "@/lib/contacts/phone";
import { obtenerContacto } from "@/lib/contacts/queries";

export const metadata: Metadata = { title: "Contacto" };

const fecha = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  dateStyle: "medium",
  timeStyle: "short",
});

const ACCIONES: Record<string, string> = {
  crear_contacto: "Contacto creado",
  editar_contacto: "Datos editados",
  marcar_no_llamar: "Marcado como “no llamar”",
};

export default function ContactoPage({ params }: PageProps<"/app/contactos/[id]">) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <Link href="/app/contactos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Contactos
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Ficha params={params} />
      </Suspense>
    </div>
  );
}

async function Ficha({ params }: Pick<PageProps<"/app/contactos/[id]">, "params">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { contacto, llamadas, citas, auditoria } = await obtenerContacto(id);
  if (!contacto) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{contacto.nombre}</h1>
            <EstadoBadge estado={contacto.estado} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {formatPhone(contacto.telefono)} · {contacto.intentos} intentos sin respuesta
            {contacto.requiere_seguimiento && ` · requiere seguimiento${contacto.seguimiento_motivo ? `: ${contacto.seguimiento_motivo}` : ""}`}
          </p>
        </div>
        <BotonLlamar
          contactoId={contacto.id}
          motivoBloqueo={contacto.estado === "no_llamar" ? "El contacto ha pedido no ser llamado" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent>
            <EditarContacto
              id={contacto.id}
              valores={{
                nombre: contacto.nombre,
                telefono: contacto.telefono,
                email: contacto.email,
                consentimiento: contacto.consentimiento,
                consentimiento_fecha: contacto.consentimiento_fecha,
                consentimiento_origen: contacto.consentimiento_origen,
                notas: contacto.notas,
              }}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Citas</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {citas.length ? (
                <ul className="flex flex-col gap-2">
                  {citas.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span>{fecha.format(new Date(c.inicio))}</span>
                      <span className="text-muted-foreground">{c.estado}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Sin citas.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {auditoria.length ? (
                <ul className="flex flex-col gap-2">
                  {auditoria.map((a) => (
                    <li key={a.id}>
                      <p>{ACCIONES[a.accion] ?? a.accion}</p>
                      <p className="text-xs text-muted-foreground">{fecha.format(new Date(a.creado_en))}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Sin cambios registrados.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Llamadas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {llamadas.length ? (
            <ul className="divide-y">
              {llamadas.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/app/llamadas/${l.id}`} className="hover:underline">
                    {fecha.format(new Date(l.creado_en))}
                  </Link>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {etiquetaClasificacion(l.clasificacion)}
                    {l.duracion_seg != null && <span className="tabular-nums">{formatearDuracion(l.duracion_seg)}</span>}
                    <EstadoLlamada estado={l.estado} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Todavía no se le ha llamado.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Exclusión y privacidad</CardTitle>
        </CardHeader>
        <CardContent>
          <ZonaExclusion id={contacto.id} nombre={contacto.nombre} noLlamar={contacto.estado === "no_llamar"} />
        </CardContent>
      </Card>
    </div>
  );
}

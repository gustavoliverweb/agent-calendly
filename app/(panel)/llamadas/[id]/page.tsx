import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CalendarCheckIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoBadge } from "@/components/contactos/estado-badge";
import { AutoRefresco } from "@/components/llamadas/auto-refresco";
import { EstadoLlamada } from "@/components/llamadas/estado-llamada";
import { Transcripcion } from "@/components/llamadas/transcripcion";
import { etiquetaClasificacion, formatearDuracion, MOTIVO_FALLO } from "@/lib/calls/estados";
import { obtenerLlamada, type Turno } from "@/lib/calls/queries";
import { formatPhone } from "@/lib/contacts/phone";

export const metadata: Metadata = { title: "Llamada" };

const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "full", timeStyle: "short" });
const fechaCorta = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" });

/** Etiquetas de los datos que recoge el agente (data collection). */
const DATOS: Record<string, string> = {
  interes: "Interés",
  motivo_rechazo: "Motivo de rechazo",
  pide_rellamada: "Pide rellamada",
  momento_rellamada: "Cuándo rellamar",
  pide_no_llamar: "Pide no ser llamado",
  email_confirmado: "Email confirmado",
};

export default function LlamadaPage({ params }: PageProps<"/llamadas/[id]">) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <Link href="/llamadas" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Llamadas
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Detalle params={params} />
      </Suspense>
    </div>
  );
}

function valorDato(v: unknown): string {
  if (v === true) return "Sí";
  if (v === false) return "No";
  if (v == null || v === "") return "—";
  return String(v);
}

async function Detalle({ params }: Pick<PageProps<"/llamadas/[id]">, "params">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const llamada = await obtenerLlamada(id);
  if (!llamada) notFound();

  const abierta = llamada.estado === "iniciada" || llamada.estado === "en_curso";
  const turnos = (Array.isArray(llamada.transcripcion) ? llamada.transcripcion : []) as Turno[];
  const analisis = (llamada.analisis ?? {}) as { data_collection_results?: Record<string, { value?: unknown }> | null };
  const datos = Object.entries(analisis.data_collection_results ?? {});
  const contacto = llamada.contactos;

  const filas: [string, React.ReactNode][] = [
    ["Inicio", fechaCorta.format(new Date(llamada.creado_en))],
    ["Duración", formatearDuracion(llamada.duracion_seg)],
    ["Resultado", etiquetaClasificacion(llamada.clasificacion) ?? (abierta ? "En curso" : "—")],
  ];
  if (llamada.motivo_fallo) filas.push(["Motivo del fallo", MOTIVO_FALLO[llamada.motivo_fallo] ?? llamada.motivo_fallo]);
  if (llamada.lote_id) filas.push(["Lote", <Link key="l" href={`/lotes`} className="underline">Ver lotes</Link>]);

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresco activo={abierta} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Llamada a {contacto?.nombre ?? "contacto borrado"}</h1>
            <EstadoLlamada estado={llamada.estado} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{fecha.format(new Date(llamada.creado_en))}</p>
        </div>
      </div>

      {llamada.cita_agendada && llamada.fecha_cita && (
        <Card className="border-green-600/30 bg-green-50 dark:bg-green-950/30">
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            <CalendarCheckIcon className="size-5 text-green-700 dark:text-green-300" />
            <span className="font-medium">Cita agendada para el {fecha.format(new Date(llamada.fecha_cita))}</span>
            <span className="ml-auto flex gap-3">
              {llamada.calendly_reschedule_url && (
                <a href={llamada.calendly_reschedule_url} target="_blank" rel="noreferrer" className="underline">
                  Reprogramar
                </a>
              )}
              {llamada.calendly_cancel_url && (
                <a href={llamada.calendly_cancel_url} target="_blank" rel="noreferrer" className="underline">
                  Cancelar
                </a>
              )}
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Transcripción</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {llamada.resultado && (
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Resumen</p>
                {llamada.resultado}
              </div>
            )}
            {abierta && !turnos.length ? (
              <p className="text-sm text-muted-foreground">
                La transcripción aparecerá aquí al terminar la llamada. Esta página se actualiza sola.
              </p>
            ) : (
              <Transcripcion turnos={turnos} />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contacto</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {contacto ? (
                <>
                  <Link href={`/contactos/${contacto.id}`} className="font-medium hover:underline">
                    {contacto.nombre}
                  </Link>
                  <span className="tabular-nums text-muted-foreground">{formatPhone(contacto.telefono)}</span>
                  {contacto.email && <span className="text-muted-foreground">{contacto.email}</span>}
                  <EstadoBadge estado={contacto.estado} className="self-start" />
                </>
              ) : (
                <p className="text-muted-foreground">Contacto borrado.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-sm">
                {filas.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          {datos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Datos recogidos</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-2 text-sm">
                  {datos.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{DATOS[k] ?? k}</dt>
                      <dd className="text-right">{valorDato(v?.value)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

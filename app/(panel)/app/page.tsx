import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { CheckCircle2Icon, CircleAlertIcon, CircleDashedIcon, TriangleAlertIcon } from "lucide-react";
import { PageHeader } from "@/components/panel/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefresco } from "@/components/llamadas/auto-refresco";
import { EstadoLlamada } from "@/components/llamadas/estado-llamada";
import {
  LATIDO_MAX_MS,
  leerAvisos,
  leerKpis,
  llamadasEnCurso,
  seguimientos,
  ultimoDespacho,
  type Kpis,
} from "@/lib/dashboard/queries";
import { createClient } from "@/lib/supabase/server";
import {
  appEnv,
  calendlyEnv,
  calendlyWebhookEnv,
  elevenLabsEnv,
  elevenLabsWebhookEnv,
  isConfigured,
  supabaseEnv,
} from "@/lib/env";

export const metadata: Metadata = { title: "Resumen" };

const entero = new Intl.NumberFormat("es-ES");
const porcentaje = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 0 });
const dolares = new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" });
const hora = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });

export default function ResumenPage() {
  return (
    <>
      <PageHeader title="Resumen" description="Actividad de hoy y de los últimos 7 días, llamadas en curso y avisos." />
      <div className="flex flex-col gap-6">
        <Suspense fallback={null}>
          <Avisos />
        </Suspense>
        <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-muted" />}>
          <Indicadores />
        </Suspense>
        <div className="grid gap-4 lg:grid-cols-2">
          <Suspense fallback={<CardSkeleton />}>
            <EnCurso />
          </Suspense>
          <Suspense fallback={<CardSkeleton />}>
            <Seguimientos />
          </Suspense>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Suspense fallback={<CardSkeleton />}>
            <Totales />
          </Suspense>
          <Suspense fallback={<CardSkeleton />}>
            <IntegracionesCard />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function Avisos() {
  // La hora actual solo existe en una petición real, nunca al prerenderizar.
  await connection();
  const avisos = await leerAvisos(new Date());
  if (!avisos.length) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Avisos">
      {avisos.map((a) => (
        <li key={a.texto}>
          <Alert variant={a.nivel === "error" ? "destructive" : "default"}>
            {a.nivel === "error" ? <CircleAlertIcon /> : <TriangleAlertIcon />}
            <AlertDescription className="flex flex-wrap items-center gap-x-3">
              <span>{a.texto}</span>
              {a.enlace && (
                <Link href={a.enlace.href} className="font-medium underline underline-offset-2">
                  {a.enlace.texto}
                </Link>
              )}
            </AlertDescription>
          </Alert>
        </li>
      ))}
    </ul>
  );
}

async function Indicadores() {
  await connection();
  const { hoy, semana } = await leerKpis(new Date());
  const conversion = (k: Kpis) => (k.contestadas ? porcentaje.format(k.citas / k.contestadas) : "—");
  const tasa = (k: Kpis) => (k.llamadas ? porcentaje.format(k.contestadas / k.llamadas) : "—");
  const tiles: { titulo: string; hoy: string; semana: string; ayuda?: string }[] = [
    { titulo: "Llamadas", hoy: entero.format(hoy.llamadas), semana: entero.format(semana.llamadas) },
    {
      titulo: "Contestadas",
      hoy: entero.format(hoy.contestadas),
      semana: `${entero.format(semana.contestadas)} (${tasa(semana)})`,
      ayuda: "Hubo conversación (sin contar buzón ni sin respuesta)",
    },
    { titulo: "Citas agendadas", hoy: entero.format(hoy.citas), semana: entero.format(semana.citas) },
    { titulo: "Conversión", hoy: conversion(hoy), semana: conversion(semana), ayuda: "Citas / llamadas contestadas" },
    { titulo: "Minutos", hoy: entero.format(Math.round(hoy.minutos)), semana: entero.format(Math.round(semana.minutos)) },
    {
      titulo: "Coste estimado",
      hoy: dolares.format(hoy.coste),
      semana: dolares.format(semana.coste),
      ayuda: "Minutos × tarifa por minuto (COSTE_MINUTO_ESTIMADO)",
    },
  ];

  return (
    <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <Card key={t.titulo} size="sm" title={t.ayuda}>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t.titulo} · hoy</span>
            <span className="text-2xl font-semibold tabular-nums">{t.hoy}</span>
            <span className="text-xs text-muted-foreground tabular-nums">7 días: {t.semana}</span>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

async function EnCurso() {
  const llamadas = await llamadasEnCurso();
  return (
    <Card>
      <AutoRefresco activo={llamadas.length > 0} />
      <CardHeader>
        <CardTitle>Llamadas en curso</CardTitle>
      </CardHeader>
      <CardContent>
        {llamadas.length ? (
          <ul className="divide-y text-sm">
            {llamadas.map((l) => (
              <li key={l.id}>
                <Link href={`/app/llamadas/${l.id}`} className="flex items-center gap-3 py-2 hover:underline">
                  <EstadoLlamada estado={l.estado} />
                  <span className="font-medium">{l.contactos?.nombre ?? "—"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {l.lote_id ? "Lote · " : ""}desde las {hora.format(new Date(l.creado_en))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Ninguna llamada en curso ahora mismo.</p>
        )}
      </CardContent>
    </Card>
  );
}

const MOTIVO_SEGUIMIENTO: Record<string, string> = {
  fallo_calendly: "Calendly no respondió",
  cita_cancelada: "Canceló la cita",
};

function motivoSeguimiento(m: string | null) {
  if (!m) return "Pendiente de revisar";
  if (m.startsWith("rellamar")) return m.replace(/^rellamar:?\s*/, "Pide rellamada ").trim();
  return MOTIVO_SEGUIMIENTO[m] ?? m;
}

async function Seguimientos() {
  const { contactos, total } = await seguimientos();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Requieren seguimiento{total ? <span className="ml-2 text-muted-foreground tabular-nums">{total}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contactos.length ? (
          <>
            <ul className="divide-y text-sm">
              {contactos.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/contactos/${c.id}`} className="flex items-center gap-3 py-2 hover:underline">
                    <span className="font-medium">{c.nombre}</span>
                    <span className="ml-auto text-right text-xs text-muted-foreground">
                      {motivoSeguimiento(c.seguimiento_motivo)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {total > contactos.length && (
              <Link href="/app/contactos?seguimiento=1" className="mt-3 inline-block text-sm font-medium underline underline-offset-2">
                Ver los {total}
              </Link>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nadie pendiente de seguimiento.</p>
        )}
      </CardContent>
    </Card>
  );
}

async function Totales() {
  const supabase = await createClient();
  const [contactos, lotes] = await Promise.all([
    supabase.from("contactos").select("id", { count: "exact", head: true }),
    supabase.from("lotes").select("id", { count: "exact", head: true }).eq("estado", "activo"),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base de contactos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {contactos.error ? (
          <p className="col-span-2 text-sm text-destructive">No se ha podido leer la base de datos.</p>
        ) : (
          <>
            <Link href="/app/contactos" className="flex flex-col hover:underline">
              <span className="text-xs text-muted-foreground">Contactos</span>
              <span className="text-3xl font-semibold tabular-nums">{entero.format(contactos.count ?? 0)}</span>
            </Link>
            <Link href="/app/lotes" className="flex flex-col hover:underline">
              <span className="text-xs text-muted-foreground">Lotes activos</span>
              <span className="text-3xl font-semibold tabular-nums">{entero.format(lotes.count ?? 0)}</span>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

async function IntegracionesCard() {
  const despacho = await ultimoDespacho();
  const ahora = new Date();
  const cronOk = despacho != null && ahora.getTime() - despacho.getTime() <= LATIDO_MAX_MS;
  const items = [
    { nombre: "Base de datos (Supabase)", ok: isConfigured(supabaseEnv) },
    { nombre: "Ajustes de la app", ok: isConfigured(appEnv) },
    { nombre: "Agente de voz (ElevenLabs)", ok: isConfigured(elevenLabsEnv) },
    { nombre: "Webhook de ElevenLabs", ok: isConfigured(elevenLabsWebhookEnv) },
    { nombre: "Agenda (Calendly)", ok: isConfigured(calendlyEnv) },
    { nombre: "Webhook de Calendly", ok: isConfigured(calendlyWebhookEnv) },
    {
      nombre: "Tarea programada (lotes)",
      ok: cronOk,
      detalle: despacho ? `última a las ${hora.format(despacho)}` : "sin ejecutar",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integraciones</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {items.map(({ nombre, ok, detalle }) => (
            <li key={nombre} className="flex items-center gap-2">
              {ok ? (
                <CheckCircle2Icon className="size-4 text-green-600" />
              ) : (
                <CircleDashedIcon className="size-4 text-muted-foreground" />
              )}
              <span>{nombre}</span>
              <span className="ml-auto text-muted-foreground">{detalle ?? (ok ? "Configurada" : "Pendiente")}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CardSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
}

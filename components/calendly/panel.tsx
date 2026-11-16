"use client";

import { useState, useTransition } from "react";
import { CalendarCheckIcon, CircleAlertIcon, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { desconectar, guardarTipoEvento } from "@/app/(panel)/app/calendly/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { etiquetaUbicacion } from "@/lib/calendly/etiquetas";

export type EstadoCalendly =
  | { estado: "sin_conectar" }
  | {
      estado: "pendiente" | "conectada" | "desconectada";
      cuenta: string | null;
      email: string | null;
      tipoUri: string | null;
      tipoNombre: string | null;
      ubicacionKind: string | null;
      webhook: boolean;
      ultimoError: string | null;
      conectadoEn: string;
    };

type Tipo = { uri: string; nombre: string; duracion: number | null; ubicaciones: { kind: string }[] };

const AVISOS: Record<string, { texto: string; error: boolean }> = {
  conectado: { texto: "Cuenta de Calendly conectada.", error: false },
  denegado: { texto: "No se ha dado permiso en Calendly. Puedes volver a intentarlo cuando quieras.", error: true },
  caducado: { texto: "La conexión ha caducado o se abrió en otro navegador. Vuelve a pulsar «Conectar con Calendly».", error: true },
  solo_propietario: { texto: "Solo el propietario de la empresa puede conectar Calendly.", error: true },
  cuenta_en_otra_empresa: { texto: "Esa cuenta de Calendly ya está conectada a otra empresa de la plataforma.", error: true },
  sin_configurar: { texto: "La conexión con Calendly aún no está disponible en la plataforma. Contacta con nosotros.", error: true },
  calendly: { texto: "Calendly no ha completado la conexión. Inténtalo de nuevo en unos minutos.", error: true },
  error: { texto: "No se ha podido guardar la conexión. Inténtalo de nuevo.", error: true },
};

const ERRORES: Record<string, string> = {
  refresh_invalido:
    "Calendly ha retirado el permiso (por ejemplo, por un cambio de contraseña o porque se revocó el acceso). Vuelve a conectar la cuenta.",
  plan_sin_api:
    "Calendly no deja reservar con esta cuenta: hace falta un plan de pago (Standard o superior). Mientras tanto, el agente ofrecerá llamar más tarde.",
  api_401: "Calendly ha rechazado el acceso. Vuelve a conectar la cuenta.",
};

const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "long", timeStyle: "short" });

export function PanelCalendly({
  estado,
  tipos,
  errorTipos,
  puedeEditar,
  oauthDisponible,
  provisional,
  aviso,
}: {
  estado: EstadoCalendly;
  tipos: Tipo[];
  errorTipos: boolean;
  puedeEditar: boolean;
  oauthDisponible: boolean;
  provisional: boolean;
  aviso: string | null;
}) {
  const conectada = estado.estado === "pendiente" || estado.estado === "conectada";
  const [tipoUri, setTipoUri] = useState(
    (estado.estado !== "sin_conectar" && estado.tipoUri) || tipos[0]?.uri || "",
  );
  const [pending, startTransition] = useTransition();
  const avisoInfo = aviso ? (AVISOS[aviso] ?? AVISOS.error) : null;

  function guardar() {
    startTransition(async () => {
      const r = await guardarTipoEvento(tipoUri);
      if (r.error) toast.error(r.error);
      else toast.success("Tipo de evento guardado: el agente ya puede reservar");
    });
  }

  function quitar() {
    startTransition(async () => {
      const r = await desconectar();
      if (r.error) toast.error(r.error);
      else toast.success("Calendly desconectado");
    });
  }

  const botonConectar = (texto: string) =>
    // Enlace normal (no <Link>): sale de la app hacia Calendly.
    puedeEditar && oauthDisponible ? (
      <a href="/api/calendly/oauth/iniciar" className={buttonVariants({ className: "w-fit" })}>
        <LinkIcon /> {texto}
      </a>
    ) : null;

  const seleccionado = tipos.find((t) => t.uri === tipoUri);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {avisoInfo && (
        <Alert variant={avisoInfo.error ? "destructive" : "default"}>
          <AlertDescription>{avisoInfo.texto}</AlertDescription>
        </Alert>
      )}

      {provisional && (
        <Alert>
          <AlertDescription>
            Ahora se usa el Calendly configurado provisionalmente por la plataforma. Cuando conectes tu cuenta, el agente
            pasará a usarla.
          </AlertDescription>
        </Alert>
      )}

      {estado.estado !== "sin_conectar" && estado.ultimoError && ERRORES[estado.ultimoError] && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{ERRORES[estado.ultimoError]}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Cuenta
            {estado.estado === "conectada" && (
              <Badge variant="secondary" className="gap-1">
                <CalendarCheckIcon className="size-3" /> Conectada
              </Badge>
            )}
            {estado.estado === "pendiente" && <Badge variant="outline">Falta elegir el tipo de evento</Badge>}
            {estado.estado === "desconectada" && <Badge variant="destructive">Desconectada</Badge>}
          </CardTitle>
          <CardDescription>
            El agente solo consulta la disponibilidad del tipo de evento que elijas y reserva en él. La cuenta debe tener
            un plan de pago de Calendly (Standard o superior) para poder reservar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {estado.estado === "sin_conectar" ? (
            <>
              <p className="text-sm text-muted-foreground">Tu empresa aún no ha conectado su cuenta de Calendly.</p>
              {botonConectar("Conectar con Calendly")}
              {!puedeEditar && (
                <p className="text-sm text-muted-foreground">Pide al propietario de la empresa que la conecte.</p>
              )}
            </>
          ) : (
            <>
              <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
                <dt className="text-muted-foreground">Cuenta</dt>
                <dd>
                  {estado.cuenta ?? "—"}
                  {estado.email && <span className="text-muted-foreground"> · {estado.email}</span>}
                </dd>
                <dt className="text-muted-foreground">Tipo de evento</dt>
                <dd>{estado.tipoNombre ?? "Sin elegir"}</dd>
                <dt className="text-muted-foreground">Ubicación</dt>
                <dd>{estado.tipoUri ? etiquetaUbicacion(estado.ubicacionKind) : "—"}</dd>
                <dt className="text-muted-foreground">Avisos de citas</dt>
                <dd>{estado.webhook ? "Activos (cambios y cancelaciones llegan al panel)" : "Sin activar"}</dd>
                <dt className="text-muted-foreground">Conectada el</dt>
                <dd>{fecha.format(new Date(estado.conectadoEn))}</dd>
              </dl>

              {estado.estado === "desconectada" && botonConectar("Volver a conectar")}

              {conectada && puedeEditar && (
                <div className="flex flex-col gap-3 border-t pt-4">
                  {errorTipos ? (
                    <p className="text-sm text-destructive">
                      No se han podido cargar tus tipos de evento de Calendly. Recarga la página en un momento.
                    </p>
                  ) : tipos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Tu cuenta de Calendly no tiene tipos de evento activos. Crea uno en Calendly y recarga esta página.
                    </p>
                  ) : (
                    <>
                      <Label htmlFor="tipo-evento">Tipo de evento para las citas del agente</Label>
                      <select
                        id="tipo-evento"
                        className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                        value={tipoUri}
                        disabled={pending}
                        onChange={(e) => setTipoUri(e.target.value)}
                      >
                        {tipos.map((t) => (
                          <option key={t.uri} value={t.uri}>
                            {t.nombre}
                            {t.duracion ? ` · ${t.duracion} min` : ""}
                          </option>
                        ))}
                      </select>
                      {seleccionado && (
                        <p className="text-xs text-muted-foreground">
                          Ubicación: {etiquetaUbicacion(seleccionado.ubicaciones[0]?.kind ?? null)}
                          {seleccionado.ubicaciones.length > 1 ? " (se usará la primera de las configuradas)" : ""}.
                        </p>
                      )}
                      <div>
                        <Button
                          type="button"
                          onClick={guardar}
                          disabled={pending || !tipoUri || (estado.estado === "conectada" && tipoUri === estado.tipoUri)}
                        >
                          {pending ? "Guardando…" : estado.estado === "conectada" ? "Cambiar tipo de evento" : "Guardar"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {puedeEditar && (
                <div className="border-t pt-4">
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="outline" disabled={pending} />}>
                      Desconectar Calendly
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Desconectar Calendly?</AlertDialogTitle>
                        <AlertDialogDescription>
                          El agente dejará de consultar huecos y de reservar: ofrecerá llamar más tarde. Las citas ya
                          reservadas siguen en tu Calendly, pero sus cambios y cancelaciones dejarán de llegar al panel.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={quitar}>Desconectar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

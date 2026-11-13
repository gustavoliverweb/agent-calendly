"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MicIcon, PhoneOffIcon } from "lucide-react";
import { toast } from "sonner";
import type { Conversation } from "@elevenlabs/client";
import { cancelarPrueba, iniciarPrueba, registrarConversacionPrueba } from "@/app/(panel)/app/guion/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ContactoPrueba = { id: string; nombre: string; telefono: string; email: string | null };

type Estado = "inactiva" | "preparando" | "conectada" | "terminada";
type Turno = { rol: "agente" | "usuario"; texto: string };

const SELECT = "h-9 w-full rounded-lg border bg-background px-3 text-sm";

/**
 * Conversación de prueba con el agente desde el navegador, con el micrófono.
 * Usa una versión concreta del guion y un contacto real de la empresa: las
 * tools funcionan de verdad (consultar huecos, reservar, no llamar) y la
 * llamada queda en el panel, marcada como prueba, con su transcripción.
 */
export function PruebaNavegador({
  versiones,
  versionInicial,
  contactos,
  disponible,
}: {
  versiones: { id: string; version: number; activa: boolean }[];
  versionInicial: string | null;
  contactos: ContactoPrueba[];
  disponible: boolean;
}) {
  const [guionId, setGuionId] = useState(versionInicial ?? versiones[0]?.id ?? "");
  const [contactoId, setContactoId] = useState(contactos[0]?.id ?? "");
  const [estado, setEstado] = useState<Estado>("inactiva");
  const [hablando, setHablando] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [llamadaId, setLlamadaId] = useState<string | null>(null);
  const sesion = useRef<Conversation | null>(null);
  const finalTurnos = useRef<HTMLLIElement | null>(null);

  // Al guardar o cargar otra versión en el formulario, la prueba pasa a usarla
  // (salvo en mitad de una conversación).
  const [inicialPrevia, setInicialPrevia] = useState(versionInicial);
  if (versionInicial !== inicialPrevia) {
    setInicialPrevia(versionInicial);
    if (versionInicial && estado !== "conectada" && estado !== "preparando") setGuionId(versionInicial);
  }

  // Salir de la página cuelga la conversación.
  useEffect(() => () => void sesion.current?.endSession(), []);

  useEffect(() => finalTurnos.current?.scrollIntoView({ block: "nearest" }), [turnos]);

  async function empezar() {
    setEstado("preparando");
    setTurnos([]);
    setLlamadaId(null);

    // Antes de crear la llamada: sin micrófono no hay prueba.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      toast.error("Hace falta permiso para usar el micrófono. Actívalo en el navegador y vuelve a probar.");
      setEstado("inactiva");
      return;
    }

    const r = await iniciarPrueba(guionId, contactoId);
    if ("error" in r) {
      toast.error(r.error);
      setEstado("inactiva");
      return;
    }
    setLlamadaId(r.llamadaId);

    let conectada = false;
    try {
      const { Conversation } = await import("@elevenlabs/client");
      sesion.current = await Conversation.startSession({
        signedUrl: r.signedUrl,
        connectionType: "websocket",
        dynamicVariables: r.variables,
        ...(r.vozId ? { overrides: { tts: { voiceId: r.vozId } } } : {}),
        onConnect: ({ conversationId }) => {
          conectada = true;
          setEstado("conectada");
          void registrarConversacionPrueba(r.llamadaId, conversationId);
        },
        onMessage: ({ message, role }) => {
          if (!message?.trim()) return;
          setTurnos((t) => [...t, { rol: role === "agent" ? "agente" : "usuario", texto: message }]);
        },
        onModeChange: ({ mode }) => setHablando(mode === "speaking"),
        onDisconnect: (detalles) => {
          sesion.current = null;
          setHablando(false);
          setEstado("terminada");
          if (detalles.reason === "error") toast.error("La conversación se cortó por un error de conexión.");
        },
        onError: (mensaje) => console.error("Prueba del agente:", mensaje),
      });
    } catch (e) {
      console.error(e);
      toast.error("No se ha podido conectar con el agente. Inténtalo de nuevo.");
      if (!conectada) {
        await cancelarPrueba(r.llamadaId);
        setEstado("inactiva");
      }
    }
  }

  async function colgar() {
    await sesion.current?.endSession();
  }

  const ocupada = estado === "preparando" || estado === "conectada";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Probar en el navegador</CardTitle>
        <CardDescription>
          Habla con el agente con tu micrófono, como si te llamara. No se marca ningún teléfono, pero todo lo demás es
          real: si reservas, la cita se crea en el calendario y el contacto se actualiza.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!disponible ? (
          <p className="text-sm text-muted-foreground">El agente de voz aún no está configurado en la plataforma.</p>
        ) : versiones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Guarda una versión del guion para poder probarla.</p>
        ) : contactos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Necesitas un contacto para probar (por ejemplo, tú mismo con tu email).{" "}
            <Link href="/app/contactos" className="underline">
              Crea uno en Contactos
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prueba-version">Versión del guion</Label>
                <select
                  id="prueba-version"
                  className={SELECT}
                  value={guionId}
                  disabled={ocupada}
                  onChange={(e) => setGuionId(e.target.value)}
                >
                  {versiones.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version}
                      {v.activa ? " (activa)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prueba-contacto">El agente cree que llama a</Label>
                <select
                  id="prueba-contacto"
                  className={SELECT}
                  value={contactoId}
                  disabled={ocupada}
                  onChange={(e) => setContactoId(e.target.value)}
                >
                  {contactos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} · {c.email ?? c.telefono}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {estado === "conectada" ? (
              <Button type="button" variant="destructive" onClick={colgar}>
                <PhoneOffIcon /> Colgar
              </Button>
            ) : (
              <Button type="button" onClick={empezar} disabled={estado === "preparando" || !guionId || !contactoId}>
                <MicIcon /> {estado === "preparando" ? "Conectando…" : "Empezar la prueba"}
              </Button>
            )}

            {estado === "conectada" && (
              <p className="flex items-center gap-2 text-sm" aria-live="polite">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    hablando ? "animate-pulse bg-emerald-500" : "bg-sky-500",
                  )}
                />
                {hablando ? "El agente está hablando…" : "Te escucha: habla con normalidad."}
              </p>
            )}

            {turnos.length > 0 && (
              <ol className="flex max-h-80 flex-col gap-2 overflow-auto rounded-lg bg-muted/50 p-3 text-sm">
                {turnos.map((t, i) => (
                  <li
                    key={i}
                    ref={i === turnos.length - 1 ? finalTurnos : undefined}
                    className={cn(
                      "max-w-[90%] rounded-lg px-3 py-2",
                      t.rol === "agente" ? "self-start bg-background" : "self-end bg-primary text-primary-foreground",
                    )}
                  >
                    {t.texto}
                  </li>
                ))}
              </ol>
            )}

            {estado === "terminada" && llamadaId && (
              <p className="text-sm text-muted-foreground">
                Prueba terminada. La transcripción, el resumen y la clasificación llegan en un minuto a{" "}
                <Link href={`/app/llamadas/${llamadaId}`} className="underline">
                  la ficha de la llamada
                </Link>
                .
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

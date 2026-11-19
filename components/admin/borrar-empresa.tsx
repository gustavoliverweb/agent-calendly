"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { borrarEmpresaAdmin } from "@/app/(admin)/admin/actions";
import type { ResultadoBaja } from "@/lib/baja-empresa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const entero = new Intl.NumberFormat("es-ES");

type Props = {
  empresaId: string;
  nombre: string;
  slug: string;
  estado: string;
  esPrincipal: boolean;
  contactos: number;
  miembros: number;
};

export function BorrarEmpresa({ empresaId, nombre, slug, estado, esPrincipal, contactos, miembros }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [resultado, setResultado] = useState<Extract<ResultadoBaja, { ok: true }> | null>(null);

  const bloqueo = esPrincipal
    ? "Es la empresa principal: usa el Calendly y la línea de entorno de la plataforma, y la siguiente empresa los heredaría. No se puede borrar."
    : estado !== "suspendida"
      ? "Para borrarla, suspéndela primero (botón Suspender, arriba)."
      : null;
  const coincide = confirmacion.trim().toLowerCase() === slug.toLowerCase();

  function borrar() {
    startTransition(async () => {
      const r = await borrarEmpresaAdmin(empresaId, confirmacion);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setResultado(r);
    });
  }

  function cerrar(abrir: boolean) {
    if (pending) return;
    if (!abrir && resultado) {
      router.push("/admin");
      return;
    }
    setAbierto(abrir);
    if (!abrir) setConfirmacion("");
  }

  const hayPendientes =
    resultado &&
    (resultado.pendientes.conversaciones > 0 || resultado.pendientes.dominios.length > 0 || resultado.pendientes.calendly);

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Baja definitiva</CardTitle>
        <CardDescription>
          Borra la empresa y todos sus datos: contactos, llamadas, transcripciones, citas, lotes, guiones, equipo,
          dominios y su conexión con Calendly. No se puede deshacer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3 text-sm">
        {bloqueo && <p className="text-muted-foreground">{bloqueo}</p>}
        <Button variant="destructive" disabled={Boolean(bloqueo)} onClick={() => setAbierto(true)}>
          Borrar empresa
        </Button>
      </CardContent>

      <Dialog open={abierto} onOpenChange={cerrar}>
        <DialogContent className="sm:max-w-lg">
          {resultado ? (
            <>
              <DialogHeader>
                <DialogTitle>{nombre} borrada</DialogTitle>
                <DialogDescription>
                  Sus datos se han eliminado. El uso mensual queda guardado en la auditoría de la plataforma.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-sm">
                {hayPendientes ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                    <p className="font-medium">Queda por hacer a mano (runbook → Baja de una empresa):</p>
                    <ul className="mt-1 list-disc pl-5">
                      {resultado.pendientes.conversaciones > 0 && (
                        <li>
                          {entero.format(resultado.pendientes.conversaciones)} conversaciones en ElevenLabs (sus IDs están en
                          la auditoría).
                        </li>
                      )}
                      {resultado.pendientes.dominios.length > 0 && (
                        <li>Quitar de Render: {resultado.pendientes.dominios.join(", ")}.</li>
                      )}
                      {resultado.pendientes.calendly && <li>Revocar el acceso de la app en la cuenta de Calendly de la empresa.</li>}
                    </ul>
                  </div>
                ) : (
                  <p>Todo lo externo (ElevenLabs, Calendly, Render e imágenes) se ha limpiado.</p>
                )}
                {resultado.sinEmpresa.length > 0 && (
                  <div>
                    <p>
                      Estas cuentas ya no pertenecen a ninguna empresa. Si no las vas a reutilizar, bórralas en Supabase →
                      Authentication → Users:
                    </p>
                    <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                      {resultado.sinEmpresa.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => router.push("/admin")}>Volver a empresas</Button>
              </DialogFooter>
            </>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (coincide) borrar();
              }}
            >
              <DialogHeader>
                <DialogTitle>¿Borrar {nombre} para siempre?</DialogTitle>
                <DialogDescription>
                  Se borrarán {entero.format(contactos)} contactos con todo su historial, el acceso de sus{" "}
                  {entero.format(miembros)} miembros, sus conversaciones en ElevenLabs, su dominio en Render y su conexión
                  con Calendly. Las citas ya reservadas siguen en su Calendly.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Antes: si aún no has facturado el mes, descarga su uso en Uso. Si la empresa quiere sus contactos, pídele que
                los exporte desde su panel.
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmar-borrado">
                  Escribe <span className="font-mono font-semibold">{slug}</span> para confirmar
                </Label>
                <Input
                  id="confirmar-borrado"
                  autoComplete="off"
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  disabled={pending}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={() => cerrar(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="destructive" disabled={!coincide || pending}>
                  {pending ? "Borrando… puede tardar un minuto" : "Borrar empresa"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

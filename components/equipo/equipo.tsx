"use client";

import { useState, useTransition } from "react";
import { CheckIcon, CopyIcon, MoreHorizontalIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ResultadoEnlace, ResultadoInvitacion, Rol } from "@/lib/equipo";
import { cn } from "@/lib/utils";

export type Miembro = {
  usuario_id: string;
  email: string;
  rol: Rol;
  creado_en: string;
  ultimo_acceso: string | null;
  pendiente: boolean;
};

export type AccionesEquipo = {
  invitar: (email: string, rol: Rol) => Promise<ResultadoInvitacion>;
  cambiarRol: (usuarioId: string, rol: Rol) => Promise<{ error?: string }>;
  quitar: (usuarioId: string) => Promise<{ error?: string }>;
  nuevoAcceso: (usuarioId: string) => Promise<ResultadoEnlace>;
};

const ROLES: [Rol, string, string][] = [
  ["operador", "Operador", "Gestiona contactos, llamadas y lotes."],
  ["propietario", "Propietario", "Además gestiona el equipo de la empresa."],
];
const ETIQUETA_ROL: Record<Rol, string> = { propietario: "Propietario", operador: "Operador" };

const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

export function Equipo({
  miembros,
  yo,
  gestionar,
  acciones,
}: {
  miembros: Miembro[];
  /** Usuario de la sesión, para avisar si se quita a sí mismo. */
  yo: string;
  gestionar: boolean;
  acciones: AccionesEquipo;
}) {
  const [pending, startTransition] = useTransition();
  const [invitando, setInvitando] = useState(false);
  const [enlace, setEnlace] = useState<{ email: string; url: string } | null>(null);
  const [quitando, setQuitando] = useState<Miembro | null>(null);

  function cambiarRol(m: Miembro, rol: Rol) {
    startTransition(async () => {
      const r = await acciones.cambiarRol(m.usuario_id, rol);
      if (r.error) toast.error(r.error);
      else toast.success(`${m.email} ahora es ${ETIQUETA_ROL[rol].toLowerCase()}`);
    });
  }

  function nuevoAcceso(m: Miembro) {
    startTransition(async () => {
      const r = await acciones.nuevoAcceso(m.usuario_id);
      if ("error" in r) toast.error(r.error);
      else if (r.tipo === "email") toast.success(`Enviado un correo a ${m.email} para elegir contraseña`);
      else setEnlace({ email: m.email, url: r.enlace });
    });
  }

  function quitar(m: Miembro) {
    startTransition(async () => {
      const r = await acciones.quitar(m.usuario_id);
      if (r.error) toast.error(r.error);
      else toast.success(`${m.email} ya no forma parte de la empresa`);
      setQuitando(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {gestionar && (
        <div>
          <Button onClick={() => setInvitando(true)}>
            <UserPlusIcon data-icon="inline-start" />
            Invitar a alguien
          </Button>
        </div>
      )}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden sm:table-cell">Último acceso</TableHead>
              {gestionar && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {miembros.map((m) => (
              <TableRow key={m.usuario_id}>
                <TableCell className="font-medium">
                  {m.email}
                  {m.usuario_id === yo && <span className="ml-2 text-xs text-muted-foreground">(tú)</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={m.rol === "propietario" ? "default" : "secondary"}>{ETIQUETA_ROL[m.rol]}</Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {m.pendiente ? (
                    <Badge variant="outline">Invitación pendiente</Badge>
                  ) : (
                    m.ultimo_acceso && fecha.format(new Date(m.ultimo_acceso))
                  )}
                </TableCell>
                {gestionar && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label="Acciones" disabled={pending} />}
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {m.rol === "operador" ? (
                          <DropdownMenuItem onClick={() => cambiarRol(m, "propietario")}>Hacer propietario</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => cambiarRol(m, "operador")}>Hacer operador</DropdownMenuItem>
                        )}
                        {/* También para quien ya entró: sin correo propio es la forma de restablecer su contraseña. */}
                        {m.usuario_id !== yo && (
                          <DropdownMenuItem onClick={() => nuevoAcceso(m)}>Nuevo enlace de acceso</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setQuitando(m)}>
                          Quitar de la empresa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={invitando} onOpenChange={setInvitando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar a alguien</DialogTitle>
            <DialogDescription>Tendrá acceso al panel de esta empresa.</DialogDescription>
          </DialogHeader>
          {invitando && (
            <FormularioInvitacion
              invitar={acciones.invitar}
              onInvitado={(email, r) => {
                setInvitando(false);
                if (r.tipo === "enlace") setEnlace({ email, url: r.enlace });
                else
                  toast.success(
                    r.tipo === "email"
                      ? `Invitación enviada a ${email}`
                      : `${email} ya tenía cuenta: puede entrar con su contraseña`,
                  );
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={enlace !== null} onOpenChange={(open) => !open && setEnlace(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enlace de acceso</DialogTitle>
            <DialogDescription>
              Envíaselo a {enlace?.email}: con él elegirá su contraseña y entrará al panel. Es personal y caduca; si
              no lo usa a tiempo, genera otro con «Nuevo enlace de acceso».
            </DialogDescription>
          </DialogHeader>
          {enlace && <CopiarEnlace url={enlace.url} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={quitando !== null} onOpenChange={(open) => !open && setQuitando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {quitando?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              {quitando?.usuario_id === yo
                ? "Eres tú: perderás el acceso a esta empresa al momento."
                : "Dejará de tener acceso a esta empresa al momento. Puedes volver a invitarle cuando quieras."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
            <Button variant="destructive" disabled={pending} onClick={() => quitando && quitar(quitando)}>
              {pending ? "Quitando…" : "Quitar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FormularioInvitacion({
  invitar,
  onInvitado,
}: {
  invitar: AccionesEquipo["invitar"];
  onInvitado: (email: string, r: Exclude<ResultadoInvitacion, { error: string }>) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("operador");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await invitar(email, rol);
          if ("error" in r) setError(r.error);
          else onInvitado(email.trim().toLowerCase(), r);
        });
      }}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="invitar-email">Email</Label>
        <Input
          id="invitar-email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="persona@empresa.com"
        />
      </div>
      <div className="grid gap-2" role="radiogroup" aria-label="Rol">
        {ROLES.map(([valor, titulo, texto]) => (
          <label
            key={valor}
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors",
              rol === valor ? "border-primary bg-muted/50" : "hover:bg-muted/30",
            )}
          >
            <input
              type="radio"
              name="rol"
              className="mt-0.5 accent-primary"
              checked={rol === valor}
              onChange={() => setRol(valor)}
            />
            <span>
              <span className="font-medium">{titulo}</span>
              <span className="block text-muted-foreground">{texto}</span>
            </span>
          </label>
        ))}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Invitando…" : "Invitar"}
      </Button>
    </form>
  );
}

export function CopiarEnlace({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
      <Button
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopiado(true);
          toast.success("Enlace copiado");
        }}
      >
        {copiado ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copiado ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

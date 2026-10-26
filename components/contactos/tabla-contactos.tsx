"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BanIcon, MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPhone } from "@/lib/contacts/phone";
import type { ContactoFila } from "@/lib/contacts/queries";
import { marcarNoLlamar } from "@/app/(panel)/contactos/actions";
import { CrearLote } from "./crear-lote";
import { EstadoBadge } from "./estado-badge";

const fecha = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function TablaContactos({ contactos }: { contactos: ContactoFila[] }) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  const visibles = contactos.map((c) => c.id);
  const todos = visibles.length > 0 && visibles.every((id) => seleccion.has(id));
  const algunos = !todos && visibles.some((id) => seleccion.has(id));
  const seleccionados = contactos.filter((c) => seleccion.has(c.id));
  const llamables = seleccionados.filter((c) => c.estado !== "no_llamar");

  function toggle(id: string, checked: boolean) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function aplicarNoLlamar(ids: string[]) {
    startTransition(async () => {
      const r = await marcarNoLlamar(ids);
      if (r.error) toast.error(r.error);
      else {
        toast.success(ids.length === 1 ? "Contacto marcado como “no llamar”" : `${ids.length} contactos marcados como “no llamar”`);
        setSeleccion(new Set());
      }
      setConfirmar(null);
    });
  }

  if (!contactos.length) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        No hay contactos con estos filtros.
      </div>
    );
  }

  return (
    <>
      {seleccion.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{seleccion.size} seleccionados</span>
          <CrearLote ids={llamables.map((c) => c.id)} onCreado={() => setSeleccion(new Set())} />
          <Button
            size="sm"
            variant="destructive"
            disabled={!llamables.length}
            onClick={() => setConfirmar(llamables.map((c) => c.id))}
          >
            <BanIcon data-icon="inline-start" />
            Marcar “no llamar”
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSeleccion(new Set())}>
            Quitar selección
          </Button>
        </div>
      )}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={todos}
                  indeterminate={algunos}
                  onCheckedChange={(checked) =>
                    setSeleccion(checked ? new Set([...seleccion, ...visibles]) : new Set())
                  }
                  aria-label="Seleccionar todos"
                />
              </TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Consent.</TableHead>
              <TableHead className="hidden md:table-cell">Último intento</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contactos.map((c) => (
              <TableRow key={c.id} data-state={seleccion.has(c.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={seleccion.has(c.id)}
                    onCheckedChange={(checked) => toggle(c.id, checked)}
                    aria-label={`Seleccionar a ${c.nombre}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/contactos/${c.id}`} className="hover:underline">
                    {c.nombre}
                  </Link>
                  {c.requiere_seguimiento && (
                    <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">• seguimiento</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums whitespace-nowrap">{formatPhone(c.telefono)}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{c.email ?? "—"}</TableCell>
                <TableCell>
                  <EstadoBadge estado={c.estado} />
                </TableCell>
                <TableCell className="hidden md:table-cell">{c.consentimiento ? "Sí" : "No"}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {c.ultimo_intento_en ? fecha.format(new Date(c.ultimo_intento_en)) : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Acciones" />}>
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/contactos/${c.id}`} />}>Ver ficha</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={c.estado === "no_llamar"}
                        onClick={() => setConfirmar([c.id])}
                      >
                        Marcar “no llamar”
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={confirmar !== null} onOpenChange={(open) => !open && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Marcar {confirmar?.length === 1 ? "este contacto" : `${confirmar?.length} contactos`} como “no llamar”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Es permanente: no se les volverá a llamar y se retiran de cualquier lote pendiente. No se
              puede deshacer desde el panel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={pending} onClick={() => confirmar && aplicarNoLlamar(confirmar)}>
              {pending ? "Marcando…" : "Marcar “no llamar”"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

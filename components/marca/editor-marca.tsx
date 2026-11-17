"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarMarca, quitarImagenMarca, subirImagenMarca } from "@/app/(panel)/app/marca/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MarcaForm, TipoImagen } from "@/lib/dominio/marca-form";

type Inicial = Required<{ [K in keyof MarcaForm]: string }>;

/** Sección Marca: nombre, color, logo, favicon y datos legales de la empresa. */
export function EditorMarca({
  inicial,
  nombreEmpresa,
  logoUrl,
  faviconUrl,
  editable,
}: {
  inicial: Inicial;
  nombreEmpresa: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  editable: boolean;
}) {
  const [datos, setDatos] = useState<Inicial>(inicial);
  const [pending, startTransition] = useTransition();
  const campo = (k: keyof Inicial) => ({
    value: datos[k],
    disabled: !editable,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDatos((d) => ({ ...d, [k]: e.target.value })),
  });
  const colorValido = /^#[0-9a-f]{6}$/i.test(datos.color);

  function guardar() {
    startTransition(async () => {
      const r = await guardarMarca(datos);
      if (r.error) toast.error(r.error);
      else toast.success("Marca guardada");
    });
  }

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Identidad</CardTitle>
          <CardDescription>Se ve en el login, en el panel y en las páginas legales de tu dominio.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre">Nombre visible</Label>
            <Input id="nombre" placeholder={nombreEmpresa} maxLength={60} {...campo("nombre")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="color">Color principal</Label>
            <div className="flex gap-2">
              <input
                type="color"
                aria-label="Elegir color"
                className="h-9 w-12 cursor-pointer rounded-lg border bg-background p-1 disabled:cursor-not-allowed"
                value={colorValido ? datos.color.toLowerCase() : "#171717"}
                disabled={!editable}
                onChange={(e) => setDatos((d) => ({ ...d, color: e.target.value }))}
              />
              <Input id="color" placeholder="#rrggbb (por defecto, negro)" maxLength={7} className="font-mono" {...campo("color")} />
            </div>
            <p className="text-xs text-muted-foreground">Botones y elementos destacados. Vacío: colores por defecto.</p>
          </div>
          <ImagenMarca tipo="logo" titulo="Logo" url={logoUrl} editable={editable} ayuda="PNG, JPG o WebP de hasta 512 KB, mejor horizontal y con fondo transparente. Se muestra a 28 px de alto." />
          <ImagenMarca tipo="favicon" titulo="Favicon" url={faviconUrl} editable={editable} ayuda="PNG cuadrado (p. ej. 512×512) de hasta 512 KB. Es el icono de la pestaña del navegador." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos legales</CardTitle>
          <CardDescription>
            Rellenan el aviso legal y la política de privacidad de tu dominio. Mientras falte alguno obligatorio, esas páginas
            se marcan como borrador y no se indexan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="razonSocial">Razón social *</Label>
            <Input id="razonSocial" maxLength={200} {...campo("razonSocial")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nif">NIF *</Label>
            <Input id="nif" maxLength={20} {...campo("nif")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email de contacto (privacidad) *</Label>
            <Input id="email" type="email" maxLength={200} {...campo("email")} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="domicilio">Domicilio *</Label>
            <Input id="domicilio" maxLength={300} {...campo("domicilio")} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="registro">Datos registrales (solo sociedades)</Label>
            <Input id="registro" maxLength={300} placeholder="Registro Mercantil de …, tomo …, folio …, hoja …" {...campo("registro")} />
          </div>
        </CardContent>
      </Card>

      {editable && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      )}
    </form>
  );
}

function ImagenMarca({ tipo, titulo, url, editable, ayuda }: { tipo: TipoImagen; titulo: string; url: string | null; editable: boolean; ayuda: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function subir(archivo: File) {
    const fd = new FormData();
    fd.set("tipo", tipo);
    fd.set("archivo", archivo);
    startTransition(async () => {
      const r = await subirImagenMarca(fd);
      if (r.error) toast.error(r.error);
      else toast.success(`${titulo} actualizado`);
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{titulo}</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-12 min-w-12 items-center justify-center rounded-lg border bg-muted/40 px-2">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={titulo} className={tipo === "logo" ? "h-7 w-auto max-w-40 object-contain" : "size-8 object-contain"} />
          ) : (
            <span className="text-xs text-muted-foreground">Sin {titulo.toLowerCase()}</span>
          )}
        </div>
        {editable && (
          <div className="flex gap-1">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
            />
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
              {pending ? "Subiendo…" : url ? "Cambiar" : "Subir"}
            </Button>
            {url && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await quitarImagenMarca(tipo);
                    if (r.error) toast.error(r.error);
                  })
                }
              >
                Quitar
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{ayuda}</p>
    </div>
  );
}

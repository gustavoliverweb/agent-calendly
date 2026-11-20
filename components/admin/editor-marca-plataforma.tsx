"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarMarcaPlataforma, quitarImagenPlataforma, subirImagenPlataforma } from "@/app/(admin)/admin/actions";
import { ImagenMarca } from "@/components/marca/editor-marca";
import { Logo } from "@/components/marca/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Datos = { nombre: string; descripcion: string; email: string };

export function EditorMarcaPlataforma({
  inicial,
  porDefecto,
  logoUrl,
  faviconUrl,
}: {
  inicial: Datos;
  porDefecto: Datos;
  logoUrl: string | null;
  faviconUrl: string | null;
}) {
  const [datos, setDatos] = useState<Datos>(inicial);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDatos((d) => ({ ...d, [k]: e.target.value }));
  const nombre = datos.nombre.trim() || porDefecto.nombre;
  const emailEjemplo = (datos.email.trim() || porDefecto.email) === porDefecto.email;
  const acciones = { subir: subirImagenPlataforma, quitar: quitarImagenPlataforma };

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await guardarMarcaPlataforma(datos);
          if (r.error) toast.error(r.error);
          else toast.success("Marca guardada. La web pública ya la muestra.");
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Identidad</CardTitle>
          <CardDescription>Deja un campo vacío para usar el valor por defecto, que aparece de ejemplo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marca-nombre">Nombre</Label>
            <Input id="marca-nombre" maxLength={60} placeholder={porDefecto.nombre} value={datos.nombre} onChange={set("nombre")} />
            <p className="text-xs text-muted-foreground">En la cabecera, el pie, los títulos de las páginas y los textos de la web.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marca-descripcion">Descripción</Label>
            <Textarea
              id="marca-descripcion"
              maxLength={300}
              rows={2}
              placeholder={porDefecto.descripcion}
              value={datos.descripcion}
              onChange={set("descripcion")}
            />
            <p className="text-xs text-muted-foreground">Una frase: va en el pie de la web y en la descripción para buscadores.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marca-email">Email de contacto</Label>
            <Input id="marca-email" type="email" maxLength={254} placeholder={porDefecto.email} value={datos.email} onChange={set("email")} />
            <p className="text-xs text-muted-foreground">
              En el pie, en Contacto y, como email del titular, en los textos legales.
              {emailEjemplo && " Mientras sea el de ejemplo, los textos legales lo marcan como pendiente."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imágenes</CardTitle>
          <CardDescription>PNG, JPG o WebP de hasta 512 KB. Sin logo, se usa el símbolo de la web con el nombre.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ImagenMarca
            tipo="logo"
            titulo="Logo"
            url={logoUrl}
            editable
            ayuda="Sustituye al símbolo y el nombre. Mejor horizontal y con fondo transparente: se ve sobre fondo claro (cabecera) y oscuro (pie)."
            acciones={acciones}
          />
          <ImagenMarca
            tipo="favicon"
            titulo="Favicon"
            url={faviconUrl}
            editable
            ayuda="El icono de la pestaña en la web pública. Cuadrado, de 64×64 o más."
            acciones={acciones}
          />
          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <span className="text-xs text-muted-foreground">Vista previa de la cabecera</span>
            <Logo nombre={nombre} logoUrl={logoUrl} />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { actualizarContacto } from "@/app/(panel)/app/contactos/actions";
import { ContactoForm, type ContactoValores } from "./contacto-form";

export function EditarContacto({ id, valores }: { id: string; valores: ContactoValores }) {
  return <ContactoForm action={actualizarContacto.bind(null, id)} valores={valores} textoBoton="Guardar cambios" />;
}

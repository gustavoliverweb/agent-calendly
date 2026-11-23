"use server";

import { headers } from "next/headers";
import { solicitudSchema } from "@/lib/contenido/contacto";
import { log } from "@/lib/log";
import { crearLimitador, ipCliente } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export type EnvioState = { ok?: boolean; error?: string };

/** 5 solicitudes por IP cada 10 minutos. */
const limitar = crearLimitador({ max: 5, ventanaMs: 10 * 60_000 });
/**
 * Tope total por instancia: aunque alguien reparta los envíos entre muchas
 * IPs, no puede llenar la tabla.
 */
const limitarTotal = crearLimitador({ max: 60, ventanaMs: 60 * 60_000 });

/**
 * Formulario de contacto de la web. Sin proveedor de email, la solicitud
 * queda guardada y el proveedor la ve en /admin/solicitudes.
 */
export async function enviarSolicitud(_prev: EnvioState, formData: FormData): Promise<EnvioState> {
  // Campo trampa: invisible para personas; si viene relleno, es un bot. Se responde como si nada.
  if (String(formData.get("web") ?? "").trim()) return { ok: true };

  const h = await headers();
  const ip = ipCliente(h);
  if (!limitar(ip) || !limitarTotal("todas")) {
    return { error: "Has enviado varias solicitudes seguidas. Espera unos minutos y vuelve a intentarlo." };
  }

  const parsed = solicitudSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // La casilla de privacidad solo se exige; no se guarda.
  const { nombre, email, empresa, telefono, sector, volumen, mensaje, origen } = parsed.data;
  const datos = { nombre, email, empresa, telefono, sector, volumen, mensaje, origen };

  const { error } = await createAdminClient().from("solicitudes_contacto").insert(datos);
  if (error) {
    log.error("guardar solicitud de contacto", { code: error.code, message: error.message });
    return { error: "No hemos podido enviar tu solicitud. Inténtalo de nuevo o escríbenos por email." };
  }
  log.info("solicitud de contacto recibida", { origen: datos.origen, sector: datos.sector });
  return { ok: true };
}

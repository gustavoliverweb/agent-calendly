"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { desconectarCalendly, elegirTipoEvento } from "@/lib/calendly/conectar";
import { getCurrentUser } from "@/lib/auth";
import { getEmpresaActual } from "@/lib/empresa";
import { log } from "@/lib/log";

export type AccionCalendlyState = { ok?: boolean; error?: string };

const SOLO_PROPIETARIO = "Solo el propietario de la empresa puede cambiar la conexión con Calendly.";

export async function guardarTipoEvento(eventTypeUri: string): Promise<AccionCalendlyState> {
  const user = await getCurrentUser();
  const empresa = await getEmpresaActual();
  if (empresa.rol !== "propietario") return { error: SOLO_PROPIETARIO };
  if (!z.url().safeParse(eventTypeUri).success) return { error: "Elige un tipo de evento." };

  const r = await elegirTipoEvento(empresa.id, user.id, eventTypeUri);
  if ("error" in r) return { error: r.error };
  refresh();
  return { ok: true };
}

export async function desconectar(): Promise<AccionCalendlyState> {
  const user = await getCurrentUser();
  const empresa = await getEmpresaActual();
  if (empresa.rol !== "propietario") return { error: SOLO_PROPIETARIO };
  try {
    await desconectarCalendly(empresa.id, user.id);
  } catch (e) {
    log.error("desconectar calendly", { error: e instanceof Error ? e.message : String(e) });
    return { error: "No se ha podido desconectar. Inténtalo de nuevo." };
  }
  refresh();
  return { ok: true };
}

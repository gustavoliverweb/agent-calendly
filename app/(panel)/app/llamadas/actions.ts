"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { lanzarLlamada } from "@/lib/calls/launch";
import { elevenLabsEnv, isConfigured } from "@/lib/env";
import { log } from "@/lib/log";

export type LlamarState = { ok?: boolean; error?: string; llamadaId?: string };

export async function llamarContacto(contactoId: string): Promise<LlamarState> {
  const user = await getCurrentUser();
  if (!z.uuid().safeParse(contactoId).success) return { error: "Contacto no válido" };
  if (!isConfigured(elevenLabsEnv)) {
    return { error: "El agente de voz todavía no está configurado (faltan las claves de ElevenLabs)." };
  }

  try {
    const r = await lanzarLlamada({ contactoId, lanzadaPor: user.id });
    refresh();
    return r.ok ? { ok: true, llamadaId: r.llamadaId } : { error: r.mensaje, llamadaId: r.llamadaId };
  } catch (e) {
    log.error("llamar contacto", { error: e instanceof Error ? e.message : String(e) });
    return { error: "No se ha podido lanzar la llamada." };
  }
}

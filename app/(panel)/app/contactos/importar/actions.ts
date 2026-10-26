"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { CAMPOS } from "@/lib/contacts/csv";
import { MAX_FILAS, resumir, validarFilas, type FilaValidada, type Resumen } from "@/lib/contacts/import";
import { normalizePhone } from "@/lib/contacts/phone";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { log } from "@/lib/log";
import { registrarAuditoria } from "@/lib/auditoria";

const LOTE = 500;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function telefonosExistentes(supabase: Supabase, telefonos: string[]) {
  const existentes = new Set<string>();
  const unicos = [...new Set(telefonos)];
  for (let i = 0; i < unicos.length; i += 300) {
    const { data, error } = await supabase
      .from("contactos")
      .select("telefono")
      .in("telefono", unicos.slice(i, i + 300));
    if (error) throw new Error(error.message);
    data.forEach((r) => existentes.add(r.telefono));
  }
  return existentes;
}

/** Para la vista previa: qué teléfonos (E.164) ya están dados de alta. */
export async function buscarExistentes(telefonos: string[]): Promise<string[]> {
  await getCurrentUser();
  const parsed = z.array(z.string().regex(/^\+[1-9]\d{7,14}$/)).max(MAX_FILAS).safeParse(telefonos);
  if (!parsed.success) return [];
  const supabase = await createClient();
  return [...(await telefonosExistentes(supabase, parsed.data))];
}

const filaSchema = z.object(Object.fromEntries(CAMPOS.map((c) => [c, z.string().max(2000).optional()])));

const entradaSchema = z.object({
  filas: z.array(filaSchema).min(1).max(MAX_FILAS),
  modoDuplicados: z.enum(["ignorar", "completar"]),
});

export type ResultadoImportacion =
  | { error: string }
  | {
      resumen: Resumen;
      importados: number;
      completados: number;
      rechazadas: Pick<FilaValidada, "linea" | "estado" | "original">[];
    };

/**
 * Importación definitiva. Vuelve a validar todo en el servidor: la vista
 * previa del navegador es solo orientativa.
 */
export async function importarContactos(input: unknown): Promise<ResultadoImportacion> {
  const user = await getCurrentUser();
  const parsed = entradaSchema.safeParse(input);
  if (!parsed.success) return { error: `El archivo no es válido (máximo ${MAX_FILAS} filas).` };
  const { filas, modoDuplicados } = parsed.data;

  const supabase = await createClient();
  try {
    const telefonos = filas.flatMap((f) => {
      const r = normalizePhone(f.telefono);
      return r.ok ? [r.e164] : [];
    });
    const existentes = await telefonosExistentes(supabase, telefonos);
    const validadas = validarFilas(filas, existentes);
    const ahora = new Date().toISOString();

    // Alta de los válidos. ignoreDuplicates cubre altas simultáneas del mismo número.
    const nuevos = validadas.filter((f) => f.estado === "valido");
    const insertados = new Set<string>();
    for (let i = 0; i < nuevos.length; i += LOTE) {
      const lote = nuevos.slice(i, i + LOTE).map(({ contacto }) => ({
        ...contacto,
        nombre: contacto.nombre!,
        telefono: contacto.telefono!,
        consentimiento_fecha: contacto.consentimiento ? (contacto.consentimiento_fecha ?? ahora) : null,
        consentimiento_origen: contacto.consentimiento
          ? (contacto.consentimiento_origen ?? "importación CSV")
          : null,
      }));
      const { data, error } = await supabase
        .from("contactos")
        .upsert(lote, { onConflict: "telefono", ignoreDuplicates: true })
        .select("telefono");
      if (error) throw new Error(error.message);
      data.forEach((r) => insertados.add(r.telefono));
    }
    for (const f of nuevos) {
      if (!insertados.has(f.contacto.telefono!)) f.estado = "duplicado_en_bd";
    }

    // Completar duplicados: solo rellena campos vacíos; nunca toca el estado.
    let completados = 0;
    if (modoDuplicados === "completar") {
      const duplicados = validadas.filter((f) => f.estado === "duplicado_en_bd");
      const actuales = new Map<string, { id: string; email: string | null; notas: string | null; consentimiento: boolean }>();
      for (let i = 0; i < duplicados.length; i += 300) {
        const { data, error } = await supabase
          .from("contactos")
          .select("id, telefono, email, notas, consentimiento")
          .in("telefono", duplicados.slice(i, i + 300).map((f) => f.contacto.telefono!));
        if (error) throw new Error(error.message);
        data.forEach((r) => actuales.set(r.telefono, r));
      }
      for (const f of duplicados) {
        const actual = actuales.get(f.contacto.telefono!);
        if (!actual) continue;
        const cambios: TablesUpdate<"contactos"> = {};
        if (!actual.email && f.contacto.email) cambios.email = f.contacto.email;
        if (!actual.notas && f.contacto.notas) cambios.notas = f.contacto.notas;
        if (!actual.consentimiento && f.contacto.consentimiento) {
          cambios.consentimiento = true;
          cambios.consentimiento_fecha = f.contacto.consentimiento_fecha ?? ahora;
          cambios.consentimiento_origen = f.contacto.consentimiento_origen ?? "importación CSV";
        }
        if (!Object.keys(cambios).length) continue;
        const { error } = await supabase.from("contactos").update(cambios).eq("id", actual.id);
        if (error) throw new Error(error.message);
        completados++;
      }
    }

    const resumen = resumir(validadas);
    await registrarAuditoria(supabase, {
      usuario: user.id,
      accion: "importar_csv",
      entidad: "contacto",
      detalle: { ...resumen, importados: insertados.size, completados, modoDuplicados },
    });

    refresh();
    return {
      resumen,
      importados: insertados.size,
      completados,
      rechazadas: validadas
        .filter((f) => f.estado !== "valido")
        .map(({ linea, estado, original }) => ({ linea, estado, original })),
    };
  } catch (e) {
    log.error("importar contactos", { message: e instanceof Error ? e.message : String(e) });
    return { error: "No se ha podido completar la importación. Inténtalo de nuevo." };
  }
}

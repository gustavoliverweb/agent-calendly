/**
 * Llamada de prueba para el tester web de ElevenLabs: crea la fila en
 * `llamadas` sin marcar ningún teléfono e imprime las variables dinámicas
 * que hay que dar al agente. Así `agendar` y `no_llamar` encuentran la
 * llamada, y el webhook post-llamada la cierra con la transcripción.
 *
 *   pnpm llamada-prueba <email | teléfono | id del contacto>
 *   pnpm llamada-prueba cerrar <id de la llamada>
 *
 * Respeta la pausa global, la lista de exclusión y la concurrencia (usa
 * crear_llamada), pero no la franja horaria ni el consentimiento: no se
 * llama a nadie. Si no llega el webhook, `cerrar` la da por fallida para
 * liberar la concurrencia.
 */
import { createClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const [arg1, arg2] = process.argv.slice(2);
if (arg1 === "cerrar") await cerrar(arg2);
else if (arg1) await crear(arg1);
else {
  console.error("Uso: pnpm llamada-prueba <email | teléfono | id del contacto>\n     pnpm llamada-prueba cerrar <id de la llamada>");
  process.exit(1);
}

async function crear(busqueda: string) {
  const contacto = await buscarContacto(busqueda);
  if (contacto.estado === "no_llamar") {
    console.error(`${contacto.nombre} está en la lista de exclusión: no se puede crear la llamada.`);
    process.exit(1);
  }

  const { data: llamadaId, error } = await supabase.rpc("crear_llamada", { p_contacto_id: contacto.id });
  if (error || !llamadaId) {
    if (error?.message === "llamada_activa") {
      const { data: abierta } = await supabase
        .from("llamadas")
        .select("id")
        .eq("contacto_id", contacto.id)
        .in("estado", ["iniciada", "en_curso"])
        .limit(1)
        .maybeSingle();
      console.error(`El contacto ya tiene una llamada abierta${abierta ? ` (${abierta.id})` : ""}.`);
      if (abierta) console.error(`Ciérrala con: pnpm llamada-prueba cerrar ${abierta.id}`);
    } else {
      console.error(`No se pudo crear la llamada: ${error?.message ?? "sin id"}`);
    }
    process.exit(1);
  }

  const variables: [string, string][] = [
    ["nombre", contacto.nombre],
    ["negocio", process.env.NEGOCIO_NOMBRE?.trim() || "(vacío: define NEGOCIO_NOMBRE)"],
    ["email", contacto.email ?? ""],
    ["tiene_email", String(Boolean(contacto.email))],
    ["ahora_madrid", ahoraMadrid()],
    ["llamada_id", llamadaId],
    ["contacto_id", contacto.id],
    ["telefono", contacto.telefono],
  ];
  const ancho = Math.max(...variables.map(([k]) => k.length));

  console.log(`Llamada de prueba creada para ${contacto.nombre}: ${llamadaId}\n`);
  console.log("Variables dinámicas para el tester web de ElevenLabs:\n");
  for (const [k, v] of variables) console.log(`  ${k.padEnd(ancho)}  ${v}`);
  console.log("\nActualiza ahora_madrid si la prueba no es inmediata.");
  console.log(`Si no llega el webhook post-llamada: pnpm llamada-prueba cerrar ${llamadaId}`);
}

async function cerrar(llamadaId: string | undefined) {
  if (!llamadaId || !UUID.test(llamadaId)) {
    console.error("Uso: pnpm llamada-prueba cerrar <id de la llamada>");
    process.exit(1);
  }
  // Solo llamadas abiertas sin conversation_id: las reales las cierra su webhook
  // o la reconciliación del dispatcher.
  const { data, error } = await supabase
    .from("llamadas")
    .update({ estado: "fallida", motivo_fallo: "prueba cerrada a mano", finalizada_en: new Date().toISOString() })
    .eq("id", llamadaId)
    .in("estado", ["iniciada", "en_curso"])
    .is("conversation_id", null)
    .select("id");
  if (error) {
    console.error(`No se pudo cerrar: ${error.message}`);
    process.exit(1);
  }
  if (!data?.length) {
    console.error("No hay ninguna llamada de prueba abierta con ese id (ya cerrada, o es una llamada real).");
    process.exit(1);
  }
  console.log(`Llamada ${llamadaId} cerrada como fallida.`);
}

type Contacto = { id: string; nombre: string; telefono: string; email: string | null; estado: string };

async function buscarContacto(busqueda: string): Promise<Contacto> {
  const consulta = supabase.from("contactos").select("id, nombre, telefono, email, estado");
  const valor = busqueda.trim();
  const { data, error } = UUID.test(valor)
    ? await consulta.eq("id", valor)
    : valor.includes("@")
      ? await consulta.eq("email", valor.toLowerCase())
      : await consulta.eq("telefono", telefonoE164(valor));
  if (error) {
    console.error(`Error al buscar el contacto: ${error.message}`);
    process.exit(1);
  }
  if (!data?.length) {
    console.error(`No hay ningún contacto con "${valor}". Créalo antes en el panel (Contactos).`);
    process.exit(1);
  }
  if (data.length > 1) {
    console.error(`Hay ${data.length} contactos con "${valor}". Usa el id del contacto.`);
    process.exit(1);
  }
  return data[0] as Contacto;
}

/** "600 11 22 33" → "+34600112233"; los números con prefijo se dejan igual. */
function telefonoE164(texto: string) {
  const limpio = texto.replace(/[\s.()-]/g, "");
  if (limpio.startsWith("+")) return limpio;
  if (limpio.startsWith("00")) return `+${limpio.slice(2)}`;
  return /^[6789]\d{8}$/.test(limpio) ? `+34${limpio}` : limpio;
}

/** Mismo formato que la app: "martes 27 de octubre de 2026, 11:15". */
function ahoraMadrid() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${partes.weekday} ${partes.day} de ${partes.month} de ${partes.year}, ${partes.hour}:${partes.minute}`;
}

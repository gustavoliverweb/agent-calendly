/**
 * Simulador de ElevenLabs y Calendly para las pruebas e2e. Un solo servidor
 * HTTP: las rutas no se pisan (/v1 y /v2 de ElevenLabs, /users, /invitees…
 * de la API de Calendly y /oauth/* de su autorización).
 *
 * Guarda cada petición en memoria. Las pruebas la consultan en
 * GET /__peticiones y la vacían con POST /__reiniciar.
 *
 * Se arranca con: node --experimental-strip-types e2e/simulador/servidor.mts <puerto>
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const puerto = Number(process.argv[2] ?? 3124);
const base = `http://localhost:${puerto}`;

type Peticion = { metodo: string; ruta: string; query: Record<string, string>; cuerpo: unknown; en: string };
let peticiones: Peticion[] = [];
let siguiente = 1;

/** MP3 mínimo (cabecera ID3): sirve para comprobar la detección del formato. */
const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.from([4, 0, 0, 0, 0, 0, 0]), Buffer.alloc(64, 0xff)]);

const VOCES = [
  {
    voice_id: "vozSimuladaLucia",
    name: "Lucía - Cercana",
    category: "premade",
    description: "Voz femenina simulada",
    labels: { gender: "female", accent: "castellano", age: "middle_aged" },
    preview_url: `${base}/muestras/lucia.mp3`,
    verified_languages: [{ language: "es", accent: "castellano", model_id: "eleven_multilingual_v2", preview_url: `${base}/muestras/lucia.mp3` }],
  },
  {
    voice_id: "vozSimuladaMario",
    name: "Mario - Profesional",
    category: "premade",
    description: "Voz masculina simulada",
    labels: { gender: "male", accent: "castellano" },
    preview_url: `${base}/muestras/mario.mp3`,
    verified_languages: [],
  },
];

/** Huecos libres: los próximos 7 días laborables a las 10:00 y 16:00 (UTC). */
function huecos(desde: string | undefined, hasta: string | undefined) {
  const inicio = desde ? new Date(desde) : new Date();
  const fin = hasta ? new Date(hasta) : new Date(inicio.getTime() + 7 * 864e5);
  const out: { status: string; start_time: string; invitees_remaining: number }[] = [];
  for (let d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate())); d < fin; d = new Date(d.getTime() + 864e5)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    for (const h of [9, 15]) {
      const t = new Date(d.getTime() + h * 3600e3);
      if (t > inicio && t < fin) out.push({ status: "available", start_time: t.toISOString(), invitees_remaining: 1 });
    }
  }
  return out;
}

function json(res: ServerResponse, estado: number, cuerpo: unknown) {
  res.writeHead(estado, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

async function leerCuerpo(req: IncomingMessage): Promise<unknown> {
  const trozos: Buffer[] = [];
  for await (const t of req) trozos.push(t as Buffer);
  const texto = Buffer.concat(trozos).toString("utf8");
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return Object.fromEntries(new URLSearchParams(texto));
  }
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", base);
  const ruta = url.pathname;
  const metodo = req.method ?? "GET";
  const cuerpo = await leerCuerpo(req);

  // --- Control de las pruebas -------------------------------------------------
  if (ruta === "/__salud") return json(res, 200, { ok: true });
  if (ruta === "/__peticiones") return json(res, 200, peticiones);
  if (ruta === "/__reiniciar" && metodo === "POST") {
    peticiones = [];
    return json(res, 200, { ok: true });
  }

  peticiones.push({ metodo, ruta, query: Object.fromEntries(url.searchParams), cuerpo, en: new Date().toISOString() });

  // --- Muestras de voz: como storage.googleapis.com, con un Content-Type erróneo.
  if (ruta.startsWith("/muestras/")) {
    res.writeHead(200, { "Content-Type": "text/plain", "Content-Length": MP3.length });
    return res.end(MP3);
  }

  // --- ElevenLabs ----------------------------------------------------------------
  if (ruta === "/v1/convai/sip-trunk/outbound-call" && metodo === "POST") {
    const n = siguiente++;
    return json(res, 200, { success: true, message: "ok", conversation_id: `conv_e2e_${n}`, sip_call_id: `sip_e2e_${n}` });
  }
  if (ruta === "/v1/convai/conversation/get-signed-url") {
    return json(res, 200, { signed_url: `ws://localhost:${puerto}/conversacion-simulada` });
  }
  if (ruta.startsWith("/v1/convai/conversations/")) {
    const id = decodeURIComponent(ruta.split("/").pop() ?? "");
    if (metodo === "DELETE") return json(res, 200, {});
    return json(res, 200, { conversation_id: id, status: "done", transcript: [], metadata: { call_duration_secs: 60 }, analysis: null });
  }
  if (ruta === "/v1/convai/phone-numbers") {
    return json(res, 200, [
      { phone_number_id: "phnum_e2e_plataforma", phone_number: "+34910000000", label: "Plataforma", provider: "sip_trunk" },
      { phone_number_id: "phnum_e2e_empresa", phone_number: "+34910000001", label: "Empresa", provider: "sip_trunk" },
    ]);
  }
  if (ruta.startsWith("/v1/convai/agents/")) {
    return json(res, 200, { agent_id: "agent_e2e", platform_settings: { overrides: { conversation_config_override: { tts: { voice_id: true } } } } });
  }
  if (ruta === "/v2/voices") {
    const q = (url.searchParams.get("search") ?? "").toLowerCase();
    return json(res, 200, { voices: VOCES.filter((v) => !q || v.name.toLowerCase().includes(q)), has_more: false, next_page_token: null });
  }
  if (ruta.startsWith("/v1/voices/")) {
    const voz = VOCES.find((v) => v.voice_id === decodeURIComponent(ruta.split("/").pop() ?? ""));
    return voz ? json(res, 200, voz) : json(res, 404, { detail: { status: "voice_not_found" } });
  }

  // --- Calendly: autorización OAuth ---------------------------------------------
  if (ruta === "/oauth/authorize") {
    // Autoriza sin preguntar y vuelve a la app con un código.
    const destino = new URL(url.searchParams.get("redirect_uri") ?? "/");
    destino.searchParams.set("code", "codigo_e2e");
    const state = url.searchParams.get("state");
    if (state) destino.searchParams.set("state", state);
    res.writeHead(302, { Location: destino.toString() });
    return res.end();
  }
  if (ruta === "/oauth/token" && metodo === "POST") {
    const n = siguiente++;
    return json(res, 200, {
      access_token: `acceso_e2e_${n}`,
      refresh_token: `renovacion_e2e_${n}`,
      token_type: "Bearer",
      expires_in: 7200,
      created_at: Math.floor(Date.now() / 1000),
      owner: `${base}/users/usuario_e2e`,
      organization: `${base}/organizations/org_e2e`,
    });
  }
  if (ruta === "/oauth/revoke") return json(res, 200, {});

  // --- Calendly: API --------------------------------------------------------------
  if (ruta === "/users/me") {
    return json(res, 200, {
      resource: { uri: `${base}/users/usuario_e2e`, name: "Agenda de pruebas", email: "agenda@e2e.test", current_organization: `${base}/organizations/org_e2e` },
    });
  }
  if (ruta === "/event_types") {
    return json(res, 200, {
      collection: [
        {
          uri: `${base}/event_types/e2e`,
          name: "Primera visita",
          active: true,
          scheduling_url: "https://calendly.com/e2e/primera-visita",
          locations: [{ kind: "google_conference" }],
        },
      ],
      pagination: { next_page: null },
    });
  }
  if (ruta === "/event_type_available_times") {
    return json(res, 200, { collection: huecos(url.searchParams.get("start_time") ?? undefined, url.searchParams.get("end_time") ?? undefined) });
  }
  if (ruta === "/invitees" && metodo === "POST") {
    const n = siguiente++;
    return json(res, 201, {
      resource: {
        uri: `${base}/scheduled_events/evento_e2e_${n}/invitees/invitado_e2e_${n}`,
        event: `${base}/scheduled_events/evento_e2e_${n}`,
        cancel_url: `https://calendly.com/cancellations/e2e_${n}`,
        reschedule_url: `https://calendly.com/reschedulings/e2e_${n}`,
      },
    });
  }
  if (ruta === "/webhook_subscriptions" && metodo === "POST") {
    return json(res, 201, { resource: { uri: `${base}/webhook_subscriptions/wh_e2e_${siguiente++}` } });
  }
  if (ruta === "/webhook_subscriptions") return json(res, 200, { collection: [], pagination: { next_page: null } });
  if (ruta.startsWith("/webhook_subscriptions/") && metodo === "DELETE") {
    res.writeHead(204);
    return res.end();
  }

  json(res, 404, { error: "ruta no simulada", ruta });
});

servidor.listen(puerto, () => console.log(`simulador e2e en ${base}`));

/**
 * Utilidades de configuración de Calendly (usa CALENDLY_TOKEN de .env.local).
 *
 *   pnpm calendly tipos                       Tipos de evento → CALENDLY_EVENT_TYPE_URI
 *   pnpm calendly webhooks                    Suscripciones de webhook existentes
 *   pnpm calendly crear-webhook <url>         Suscribe <url> a invitee.created/canceled
 *   pnpm calendly borrar-webhook <uri>        Borra una suscripción concreta
 *
 * crear-webhook usa CALENDLY_WEBHOOK_SIGNING_KEY como clave de firma.
 */
export {};

const API = process.env.CALENDLY_API_BASE || "https://api.calendly.com";
const token = process.env.CALENDLY_TOKEN;
if (!token) {
  console.error("Falta CALENDLY_TOKEN en .env.local");
  process.exit(1);
}

async function api<T>(ruta: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(new URL(ruta, API), {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    console.error(`Calendly ${res.status} en ${ruta}:`, await res.text());
    process.exit(1);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

type Yo = { resource: { uri: string; name: string; current_organization: string } };
type EventType = {
  uri: string;
  name: string;
  active: boolean;
  duration: number;
  scheduling_url: string;
  locations?: { kind: string; location?: string }[] | null;
  custom_questions?: { name: string; required: boolean; enabled: boolean; type: string }[];
};
type Webhook = { uri: string; callback_url: string; state: string; events: string[]; scope: string };

const [comando, arg] = process.argv.slice(2);
const { resource: yo } = await api<Yo>("/users/me");

switch (comando) {
  case "tipos": {
    const { collection } = await api<{ collection: EventType[] }>(
      `/event_types?user=${encodeURIComponent(yo.uri)}&count=100`,
    );
    console.log(`Usuario: ${yo.name}\n`);
    for (const t of collection) {
      console.log(`${t.active ? "●" : "○"} ${t.name} (${t.duration} min)`);
      console.log(`  CALENDLY_EVENT_TYPE_URI=${t.uri}`);
      console.log(`  Reserva web: ${t.scheduling_url}`);
      const ubic = (t.locations ?? []).map((l) => l.kind);
      console.log(`  Ubicaciones: ${ubic.length ? ubic.join(", ") : "ninguna"}`);
      if (ubic.length > 1) console.log("  ⚠ Varias ubicaciones: define CALENDLY_LOCATION_KIND (y CALENDLY_LOCATION si hace falta).");
      const obligatorias = (t.custom_questions ?? []).filter((q) => q.enabled && q.required);
      if (obligatorias.length) {
        console.log(`  ⚠ Preguntas obligatorias (la reserva por API fallará): ${obligatorias.map((q) => `"${q.name}"`).join(", ")}`);
      }
      console.log();
    }
    break;
  }
  case "webhooks": {
    const q = `organization=${encodeURIComponent(yo.current_organization)}&user=${encodeURIComponent(yo.uri)}&scope=user`;
    const { collection } = await api<{ collection: Webhook[] }>(`/webhook_subscriptions?${q}`);
    if (!collection.length) console.log("No hay suscripciones.");
    for (const w of collection) console.log(`${w.state}  ${w.callback_url}  [${w.events.join(", ")}]\n  ${w.uri}`);
    break;
  }
  case "crear-webhook": {
    const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    if (!arg?.startsWith("https://")) {
      console.error("Uso: pnpm calendly crear-webhook https://<dominio>/api/webhooks/calendly");
      process.exit(1);
    }
    if (!signingKey) {
      console.error("Falta CALENDLY_WEBHOOK_SIGNING_KEY en .env.local (openssl rand -hex 32)");
      process.exit(1);
    }
    const { resource } = await api<{ resource: Webhook }>("/webhook_subscriptions", {
      method: "POST",
      body: {
        url: arg,
        events: ["invitee.created", "invitee.canceled"],
        organization: yo.current_organization,
        user: yo.uri,
        scope: "user",
        signing_key: signingKey,
      },
    });
    console.log(`Webhook creado (${resource.state}): ${resource.uri}`);
    break;
  }
  case "borrar-webhook": {
    if (!arg?.startsWith(`${API}/webhook_subscriptions/`)) {
      console.error("Uso: pnpm calendly borrar-webhook <uri completa de la suscripción>");
      process.exit(1);
    }
    await api(new URL(arg).pathname, { method: "DELETE" });
    console.log("Suscripción borrada.");
    break;
  }
  default:
    console.error("Comandos: tipos | webhooks | crear-webhook <url> | borrar-webhook <uri>");
    process.exit(1);
}

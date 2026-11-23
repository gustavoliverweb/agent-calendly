import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, CONTRASENA, db, entrar, peticionesSimulador, reiniciarSimulador } from "./datos";
import { SECRETOS, urlEmpresa } from "./entorno";

/**
 * Recorrido completo de una empresa, en orden: el proveedor la da de alta,
 * el propietario la prepara y lanza un lote, la llamada termina y,
 * al final, el proveedor la da de baja. Cada paso depende del anterior.
 */
test.describe.configure({ mode: "serial" });

const EMPRESA = { nombre: "Clínica E2E", slug: "e2e-clinica" };
const PROPIETARIO = "propietario@e2e.test";
const VOZ = { id: "vozSimuladaLucia", nombre: "Lucía - Cercana" };
const LINEA = "phnum_e2e_empresa";

let empresaId = "";
let enlaceInvitacion = "";

async function entrarComoAdmin(page: Page, destino = "/admin") {
  await entrar(page, ADMIN.email, destino);
}

test("el proveedor da de alta la empresa y obtiene el enlace de invitación", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.getByRole("button", { name: "Nueva empresa" }).click();
  await page.getByLabel("Nombre").fill(EMPRESA.nombre);
  await page.getByLabel("Identificador").fill(EMPRESA.slug);
  await page.getByLabel("Email del propietario").fill(PROPIETARIO);
  await page.getByRole("button", { name: "Crear empresa" }).click();

  await expect(page.getByRole("heading", { name: "Empresa creada" })).toBeVisible();
  // Sin SMTP, la invitación es un enlace que el proveedor envía a mano, con
  // la dirección de la empresa (marca blanca), no la de la plataforma.
  enlaceInvitacion = await page.locator("input[readonly]").inputValue();
  expect(enlaceInvitacion).toContain(urlEmpresa(EMPRESA.slug, "/auth/confirm"));

  const { data } = await db.from("empresas").select("id").eq("slug", EMPRESA.slug).single();
  empresaId = data!.id;
});

test("el proveedor asigna la línea y la tarifa", async ({ page }) => {
  await entrarComoAdmin(page, `/admin/empresas/${empresaId}`);
  await page.locator("#linea").selectOption(LINEA);
  await page.getByLabel("Tarifa por minuto (EUR)").fill("0,25");
  await page.getByRole("button", { name: "Guardar", exact: true }).first().click();

  await expect
    .poll(async () => (await db.from("empresas").select("phone_number_id, precio_minuto").eq("id", empresaId).single()).data)
    .toMatchObject({ phone_number_id: LINEA, precio_minuto: 0.25 });
});

test("el proveedor ofrece una voz del catálogo", async ({ page }) => {
  await entrarComoAdmin(page, "/admin/voces");
  await page.getByRole("button", { name: "Añadir voz" }).click();
  const fila = page.getByRole("listitem").filter({ hasText: VOZ.nombre });
  await fila.getByRole("button", { name: "Elegir" }).click();
  await expect(page.getByLabel("Nombre")).toHaveValue(VOZ.nombre);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Voz añadida al catálogo")).toBeVisible();

  // La muestra llega de "Google" como text/plain y la app la sirve como MP3.
  const muestra = await page.request.get(`/admin/voces/muestra/${VOZ.id}`);
  expect(muestra.status()).toBe(200);
  expect(muestra.headers()["content-type"]).toBe("audio/mpeg");
});

test("el propietario entra con la invitación y elige su contraseña", async ({ page }) => {
  await page.goto(enlaceInvitacion);
  await expect(page).toHaveURL(/\/cuenta\/contrasena/);
  await page.getByLabel("Contraseña nueva").fill(CONTRASENA);
  await page.getByLabel("Repite la contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();

  await expect(page).toHaveURL(/\/app$/);
  // Primeros pasos: solo la línea está hecha (la asignó el proveedor).
  await expect(page.getByText("Primeros pasos")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progreso de los primeros pasos" })).toHaveAttribute("aria-valuenow", "1");
});

test("el propietario escribe el guion con la voz elegida y lo activa", async ({ page }) => {
  await entrar(page, PROPIETARIO, "/app/guion");
  await page.locator("#negocio_nombre").fill("Clínica E2E");
  await page.locator("#nombre_agente").fill("Clara");
  await page.locator("#voz").selectOption(VOZ.id);
  await expect(page.getByLabel(`Muestra de la voz ${VOZ.nombre}`)).toBeVisible();
  await page.locator("#negocio").fill("Clínica dental en Madrid con 20 años de experiencia.");
  await page.locator("#motivo").fill("Nos dejó sus datos en la web para una revisión gratuita.");
  await page.locator("#oferta").fill("Revisión y limpieza gratuitas este mes.");
  await page.locator("#cita").fill("Cita presencial de 30 minutos en la clínica.");
  await page.getByRole("button", { name: "Guardar y activar" }).click();

  await expect
    .poll(async () => {
      const { data } = await db.from("empresas").select("guion_activo_id, guiones!empresas_guion_activo_fkey (voz_id)").eq("id", empresaId).single();
      return (data?.guiones as { voz_id: string | null } | null)?.voz_id ?? null;
    })
    .toBe(VOZ.id);
});

test("el propietario importa contactos desde un CSV", async ({ page }) => {
  await entrar(page, PROPIETARIO, "/app/contactos/importar");
  const csv = [
    "nombre;telefono;email;consentimiento;fecha de consentimiento;origen del consentimiento",
    "Ana E2E;612345601;ana@e2e.test;sí;01/11/2026;Formulario web",
    "Luis E2E;612345602;luis@e2e.test;sí;01/11/2026;Formulario web",
    "Sin teléfono;;x@e2e.test;sí;01/11/2026;Formulario web",
  ].join("\n");
  await page.locator('input[type="file"]').setInputFiles({ name: "contactos.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Ver vista previa" }).click();
  await page.getByRole("button", { name: "Importar 2 contactos" }).click();
  await expect(page.getByText("Importación terminada")).toBeVisible();

  const { count } = await db.from("contactos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
  expect(count).toBe(2);
});

test("el propietario lanza un lote y el agente llama con su línea y su voz", async ({ page, request }) => {
  // Franja de llamadas todo el día, para que la prueba no dependa de la hora.
  await db
    .from("configuracion")
    .update({ franjas: [{ dias: [1, 2, 3, 4, 5, 6, 7], desde: "00:00", hasta: "23:59" }], festivos: [] })
    .eq("empresa_id", empresaId);
  await reiniciarSimulador();

  await entrar(page, PROPIETARIO, "/app/contactos");
  await page.getByLabel("Seleccionar a Ana E2E").check();
  await page.getByRole("button", { name: /Llamar a seleccionados \(1\)/ }).click();
  await page.getByRole("button", { name: "Crear lote y empezar" }).click();
  await expect(page).toHaveURL(/\/app\/lotes\/[0-9a-f-]+/);

  // Una pasada del motor de lotes, como la de pg_cron.
  const cron = await request.post("/api/cron/despachar", { headers: { Authorization: `Bearer ${SECRETOS.cron}` } });
  expect(cron.ok()).toBe(true);

  await expect
    .poll(async () => (await peticionesSimulador()).filter((p) => p.ruta === "/v1/convai/sip-trunk/outbound-call").length)
    .toBe(1);
  const llamada = (await peticionesSimulador()).find((p) => p.ruta === "/v1/convai/sip-trunk/outbound-call")!;
  const cuerpo = llamada.cuerpo as {
    agent_phone_number_id: string;
    to_number: string;
    conversation_initiation_client_data: { dynamic_variables: Record<string, unknown>; conversation_config_override?: { tts?: { voice_id?: string } } };
  };
  expect(cuerpo.agent_phone_number_id).toBe(LINEA);
  expect(cuerpo.to_number).toBe("+34612345601");
  expect(cuerpo.conversation_initiation_client_data.conversation_config_override?.tts?.voice_id).toBe(VOZ.id);
  expect(cuerpo.conversation_initiation_client_data.dynamic_variables.primer_mensaje).toEqual(expect.stringContaining("Ana E2E"));
});

test("ElevenLabs avisa del fin de la llamada y queda registrada con su duración", async ({ page, request }) => {
  const { data: llamada } = await db
    .from("llamadas")
    .select("id, conversation_id")
    .eq("empresa_id", empresaId)
    .not("conversation_id", "is", null)
    .single();
  expect(llamada?.conversation_id).toMatch(/^conv_e2e_/);

  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = JSON.stringify({
    type: "post_call_transcription",
    event_timestamp: ahora,
    data: {
      conversation_id: llamada!.conversation_id,
      transcript: [
        { role: "agent", message: "Hola, ¿hablo con Ana E2E?" },
        { role: "user", message: "Sí, pero ahora no me interesa, gracias." },
      ],
      metadata: { start_time_unix_secs: ahora - 95, call_duration_secs: 95, termination_reason: "end_call", phone_call: { call_result: "answered" } },
      analysis: { call_successful: "success", transcript_summary: "La persona no está interesada por ahora.", data_collection_results: {} },
      conversation_initiation_client_data: { dynamic_variables: { llamada_id: llamada!.id } },
    },
  });
  const firma = `t=${ahora},v0=${createHmac("sha256", SECRETOS.webhookElevenLabs).update(`${ahora}.${cuerpo}`).digest("hex")}`;
  const res = await request.post("/api/webhooks/elevenlabs", {
    headers: { "Content-Type": "application/json", "elevenlabs-signature": firma },
    data: cuerpo,
  });
  expect(res.ok()).toBe(true);

  await expect
    .poll(async () => (await db.from("llamadas").select("estado, duracion_seg").eq("id", llamada!.id).single()).data)
    .toMatchObject({ estado: "completada", duracion_seg: 95 });

  // Un webhook sin firma válida se rechaza.
  const falso = await request.post("/api/webhooks/elevenlabs", {
    headers: { "Content-Type": "application/json", "elevenlabs-signature": `t=${ahora},v0=${"0".repeat(64)}` },
    data: cuerpo,
  });
  expect(falso.status()).toBeGreaterThanOrEqual(400);

  await entrar(page, PROPIETARIO, "/app/llamadas");
  await expect(page.getByRole("row").filter({ hasText: "Ana E2E" }).getByText("Completada")).toBeVisible();
});

test("el uso del mes refleja los minutos de la llamada", async ({ page }) => {
  const { data: uso } = await db.rpc("uso_mensual", { p_empresa_id: empresaId, p_meses: 1 });
  expect(Number(uso?.[0]?.segundos)).toBe(95);
  await entrar(page, PROPIETARIO, "/app/uso");
  await expect(page.getByRole("heading", { name: "Uso" })).toBeVisible();
});

test("el propietario exporta sus contactos con el resultado de las llamadas", async ({ page }) => {
  await entrar(page, PROPIETARIO, "/app/contactos");
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exportar CSV" }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^contactos-e2e-clinica-\d{4}-\d{2}-\d{2}\.csv$/);
  const contenido = readFileSync(await descarga.path(), "utf8");
  expect(contenido).toContain("Ana E2E");
  expect(contenido).toContain("Luis E2E");
  expect(contenido.split("\n")[0]).toContain("Teléfono");

  const { data: auditoria } = await db.from("auditoria").select("accion").eq("empresa_id", empresaId).eq("accion", "exportar_contactos");
  expect(auditoria?.length).toBe(1);
});

test("el proveedor suspende y da de baja la empresa, y se borran sus conversaciones", async ({ page }) => {
  await reiniciarSimulador();
  await entrarComoAdmin(page, `/admin/empresas/${empresaId}`);

  // Activa no se puede borrar.
  await expect(page.getByRole("button", { name: "Borrar empresa" })).toBeDisabled();
  await page.getByRole("button", { name: "Suspender" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Suspender" }).click();
  await expect(page.getByText("Empresa suspendida")).toBeVisible();

  await page.getByRole("button", { name: "Borrar empresa" }).click();
  const dialogo = page.getByRole("dialog");
  const confirmar = dialogo.getByRole("button", { name: "Borrar empresa" });
  await expect(confirmar).toBeDisabled();
  await dialogo.getByLabel(/para confirmar/).fill(EMPRESA.slug);
  await confirmar.click();
  await expect(dialogo.getByText(`${EMPRESA.nombre} borrada`)).toBeVisible({ timeout: 30_000 });
  await expect(dialogo.getByText(PROPIETARIO)).toBeVisible();

  const borradas = (await peticionesSimulador()).filter((p) => p.metodo === "DELETE" && p.ruta.startsWith("/v1/convai/conversations/"));
  expect(borradas.length).toBe(1);
  const { count } = await db.from("empresas").select("id", { count: "exact", head: true }).eq("id", empresaId);
  expect(count).toBe(0);
  const { data: rastro } = await db.from("auditoria").select("detalle").eq("accion", "borrar_empresa").eq("entidad_id", empresaId).single();
  expect(rastro?.detalle).toMatchObject({ slug: EMPRESA.slug, uso_mensual: [expect.objectContaining({ segundos: 95 })] });
});

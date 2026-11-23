import { expect, test } from "@playwright/test";
import { ADMIN, CONTRASENA, contactoDePrueba, db, empresaDePrueba, entrar, esperarNoExiste, peticionesSimulador, reiniciarSimulador, usuario } from "./datos";
import { SIMULADOR_URL, urlEmpresa } from "./entorno";

/**
 * Aislamiento entre empresas, permisos por rol, marca blanca por dominio,
 * conexión de Calendly y marca de la plataforma. Cada prueba prepara sus
 * propios datos en la BD de pruebas.
 */

type Empresa = Awaited<ReturnType<typeof empresaDePrueba>>;
let a: Empresa;
let b: Empresa;
let contactoA = "";
let contactoB = "";
const OPERADOR = "operador-a@e2e.test";

test.beforeAll(async () => {
  a = await empresaDePrueba("e2e-a", "Empresa A", { operador: OPERADOR });
  b = await empresaDePrueba("e2e-b", "Empresa B");
  contactoA = await contactoDePrueba(a.id, "Contacto de A", "+34611000001");
  contactoB = await contactoDePrueba(b.id, "Contacto de B", "+34611000002");
});

test.describe("aislamiento entre empresas", () => {
  test("cada empresa ve solo sus contactos, también por URL directa", async ({ page }) => {
    await entrar(page, a.propietario, "/app/contactos");
    await expect(page.getByText("Contacto de A")).toBeVisible();
    await expect(page.getByText("Contacto de B")).toHaveCount(0);

    await page.goto(`/app/contactos/${contactoA}`);
    await expect(page.getByRole("heading", { name: "Contacto de A" })).toBeVisible();
    await page.goto(`/app/contactos/${contactoB}`);
    await esperarNoExiste(page);
    await expect(page.getByText("Contacto de B")).toHaveCount(0);
    await expect(page.getByText("+34611000002")).toHaveCount(0);
  });

  test("la exportación solo incluye los contactos de la propia empresa", async ({ page }) => {
    await entrar(page, a.propietario, "/app/contactos");
    const csv = await (await page.request.get("/app/contactos/exportar")).text();
    expect(csv).toContain("Contacto de A");
    expect(csv).not.toContain("Contacto de B");
  });

  test("/admin no existe para quien no administra la plataforma", async ({ page }) => {
    await entrar(page, a.propietario, "/app");
    await page.goto("/admin");
    await esperarNoExiste(page);
  });
});

test.describe("permisos por rol", () => {
  test("el operador no puede cambiar el guion ni la conexión de Calendly", async ({ page }) => {
    await entrar(page, OPERADOR, "/app");
    await expect(page.getByText("Lo hace el propietario de la empresa.").first()).toBeVisible();

    await page.goto("/app/guion");
    await expect(page.getByRole("button", { name: "Guardar y activar" })).toHaveCount(0);
    await page.goto("/app/calendly");
    await expect(page.getByRole("link", { name: /Conectar/ })).toHaveCount(0);
  });

  test("el operador sí puede exportar contactos (los ve igual en el panel)", async ({ page }) => {
    await entrar(page, OPERADOR, "/app/contactos");
    const res = await page.request.get("/app/contactos/exportar");
    expect(res.ok()).toBe(true);
    expect(await res.text()).toContain("Contacto de A");
  });
});

test.describe("marca blanca", () => {
  test("en su dominio, la empresa ve su marca y no la de la plataforma", async ({ page }) => {
    await entrar(page, b.propietario, "/app/marca");
    await page.getByLabel("Nombre visible").fill("Dental Bravo");
    await page.getByRole("button", { name: "Guardar" }).first().click();
    await expect(page.getByText("Marca guardada")).toBeVisible();

    await page.goto(urlEmpresa(b.slug, "/login"));
    await expect(page).toHaveTitle(/Dental Bravo/);
    await expect(page.getByText("Dental Bravo").first()).toBeVisible();
    await expect(page.getByText("Cadencia")).toHaveCount(0);
  });

  test("en el dominio de una empresa no hay web pública ni /admin", async ({ page }) => {
    await page.goto(urlEmpresa(b.slug, "/"));
    await expect(page).toHaveURL(/\/login/);
    // Las páginas de la web pública las corta el proxy con un 404 de verdad.
    const precios = await page.goto(urlEmpresa(b.slug, "/precios"));
    expect(precios?.status()).toBe(404);

    // Con sesión del propietario de B, /admin tampoco existe en su dominio.
    await page.goto(urlEmpresa(b.slug, "/login?next=/app"));
    await page.getByLabel("Email").fill(b.propietario);
    await page.getByLabel("Contraseña").fill(CONTRASENA);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(urlEmpresa(b.slug, "/app"));
    await page.goto(urlEmpresa(b.slug, "/admin"));
    await esperarNoExiste(page);
  });

  test("un usuario de otra empresa no entra por el dominio de B", async ({ page }) => {
    await page.goto(urlEmpresa(b.slug, "/login?next=/app"));
    await page.getByLabel("Email").fill(a.propietario);
    await page.getByLabel("Contraseña").fill(CONTRASENA);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    // El mismo mensaje que una contraseña mala: no revela que la cuenta existe en otra empresa.
    await expect(page.getByText("Email o contraseña incorrectos")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("un dominio que no es de nadie da 404", async ({ page }) => {
    await page.goto(urlEmpresa("e2e-no-existe", "/login"));
    await esperarNoExiste(page);
  });
});

test.describe("Calendly", () => {
  test("el propietario conecta su Calendly por OAuth y elige el tipo de evento", async ({ page }) => {
    await reiniciarSimulador();
    await entrar(page, a.propietario, "/app/calendly");
    await page.getByRole("link", { name: /Conectar/ }).first().click();

    // El simulador autoriza sin preguntar y vuelve a la app.
    await expect(page).toHaveURL(/\/app\/calendly/);
    await page.locator("#tipo-evento").selectOption(`${SIMULADOR_URL}/event_types/e2e`);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect
      .poll(async () => (await db.from("integraciones_calendly").select("estado").eq("empresa_id", a.id).single()).data?.estado)
      .toBe("conectada");
    await expect(page.getByText("Agenda de pruebas")).toBeVisible();

    const { data } = await db.from("integraciones_calendly").select("access_token, event_type_uri").eq("empresa_id", a.id).single();
    // Los tokens se guardan cifrados, nunca en claro.
    expect(data?.access_token).not.toContain("acceso_e2e_");
    expect(data?.event_type_uri).toMatch(/\/event_types\/e2e$/);

    const peticiones = await peticionesSimulador();
    const token = peticiones.find((p) => p.ruta === "/oauth/token");
    expect((token?.cuerpo as Record<string, string>).code_verifier).toBeTruthy();
    expect(peticiones.some((p) => p.ruta === "/webhook_subscriptions" && p.metodo === "POST")).toBe(true);
  });
});

test.describe("marca de la plataforma", () => {
  test("el proveedor cambia el nombre y la web lo muestra al momento", async ({ page }) => {
    await usuario(ADMIN.email);
    await entrar(page, ADMIN.email, "/admin/marca");
    await page.getByLabel("Nombre").fill("Vozia E2E");
    await page.getByLabel("Email de contacto").fill("hola@vozia-e2e.es");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(/Marca guardada/)).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveTitle(/Vozia E2E/);
    await page.goto("/contacto");
    await expect(page.getByRole("link", { name: "hola@vozia-e2e.es" }).first()).toBeVisible();

    // Las páginas con parámetro se regeneran con la marca nueva sin error
    // (antes daban 500 al regenerarse: leían params fuera de <Suspense>).
    for (const ruta of ["/soluciones/clinicas", "/soluciones/b2b", "/recursos/que-necesitas-para-empezar"]) {
      const res = await page.goto(ruta);
      expect(res?.status(), ruta).toBe(200);
      await expect(page).toHaveTitle(/Vozia E2E/);
    }

    // Se deja como estaba: el resto de pruebas esperan la marca por defecto.
    await page.goto("/admin/marca");
    await page.getByLabel("Nombre").fill("");
    await page.getByLabel("Email de contacto").fill("");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(/Marca guardada/)).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveTitle(/Cadencia/);
  });
});

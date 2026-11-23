import { expect, test } from "@playwright/test";

test.describe("web pública", () => {
  test("la portada carga con la marca por defecto", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Cadencia/);
    await expect(page.getByRole("link", { name: /solicitar una demo|hablemos/i }).first()).toBeVisible();
  });

  test("las páginas legales son borrador y no se indexan", async ({ page }) => {
    await page.goto("/aviso-legal");
    await expect(page.getByText(/Borrador: esta página no se indexa/)).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("/admin sin sesión lleva al acceso", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});

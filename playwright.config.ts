import { defineConfig } from "@playwright/test";
import { APP_URL, CERTIFICADO, CONTROL_URL, entornoApp, PUERTO_APP, PUERTO_CONTROL, PUERTO_SIMULADOR } from "./e2e/entorno";

/**
 * Pruebas e2e (pnpm e2e): la app compilada aparte (.next-e2e) contra el
 * Supabase de pruebas (.env.test) y el simulador de ElevenLabs y Calendly.
 * Usa el Google Chrome del sistema: no hace falta descargar navegadores.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "./e2e/resultados",
  // Comparten base de datos: en serie, en un solo worker.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/preparar.ts",
  use: {
    baseURL: APP_URL,
    channel: "chrome",
    headless: true,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    // El simulador usa un certificado autofirmado (autorización de Calendly).
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `node e2e/simulador/servidor.mts ${PUERTO_SIMULADOR} ${PUERTO_CONTROL} ${CERTIFICADO.clave} ${CERTIFICADO.cert}`,
      url: `${CONTROL_URL}/__salud`,
      reuseExistingServer: false,
      stdout: "ignore",
    },
    {
      // Compila con el entorno de pruebas (NEXT_PUBLIC_* se fija al compilar) y arranca.
      command: `pnpm exec next build && pnpm exec next start -p ${PUERTO_APP}`,
      url: APP_URL,
      env: entornoApp(),
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});

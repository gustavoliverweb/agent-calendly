# Pruebas e2e

`pnpm e2e` abre la app en Google Chrome (el del sistema) y la recorre como lo haría una persona. La app se compila aparte (`.next-e2e`) y trabaja contra:

- **Supabase de pruebas**: un proyecto aparte, configurado en `.env.test`. Nunca contra producción: `e2e/entorno.ts` se niega a arrancar si `.env.test` apunta al mismo proyecto que `.env.local`.
- **Simulador de ElevenLabs y Calendly** (`e2e/simulador/servidor.mts`): un servidor local que responde como ellos y guarda cada petición para que las pruebas la comprueben. No se llama a ningún servicio real ni se gasta nada.

Todas las claves sensibles se fijan en `e2e/entorno.ts` con valores falsos. Las variables de proceso tienen prioridad sobre `.env.local`, así que la app de pruebas nunca ve las reales.

Al empezar, `e2e/preparar.ts` borra lo que dejaron ejecuciones anteriores: las empresas con slug `e2e-*`, los usuarios `@e2e.test`, las voces simuladas y la marca de la plataforma. Después crea el administrador de pruebas.

## `.env.test`

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
SUPABASE_PROJECT_REF=<ref>
SUPABASE_DB_PASSWORD=…
SUPABASE_POOLER_HOST=aws-1-eu-west-1.pooler.supabase.com
```

El proyecto de pruebas actual está en Irlanda (eu-west-1), no en Fráncfort como producción: por eso lleva su propio `SUPABASE_POOLER_HOST`.

## Preparar un proyecto Supabase nuevo

Vale para recrear el de pruebas, y también para producción si algún día se recrea.

1. **Antes de aplicar las migraciones**, ejecuta `supabase/pruebas/permisos-por-defecto.sql` en el SQL Editor del proyecto nuevo. Los proyectos creados desde 2025 no dan permisos automáticos sobre las tablas y funciones nuevas a `anon`, `authenticated` y `service_role`. Nuestras migraciones cuentan con ellos: solo quitan permisos donde hace falta, y la protección real es RLS. Sin este paso, la app no puede leer nada, ni siquiera con service role.
2. `pnpm db:pruebas:push` para aplicar las migraciones (`pnpm db:pruebas:status` para ver el estado).
3. Authentication → URL Configuration: Site URL `http://localhost:3123` y Redirect URL `http://localhost:3123/**`.
4. `DB_ENV=.env.test scripts/db.sh test` pasa las pruebas de base de datos contra ese proyecto. Tienen que salir todas OK.

No hace falta pg_cron ni Vault: en las pruebas, el motor de lotes se llama directamente.

El plan gratuito pausa el proyecto tras una semana sin uso. Si `pnpm e2e` no conecta, reactívalo desde el panel de Supabase.

## Ejecutar

```
pnpm e2e                          # todas
pnpm e2e e2e/web.spec.ts          # un archivo
pnpm exec playwright show-report  # informe HTML del último fallo (con trazas)
```

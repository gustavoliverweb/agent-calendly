# Pruebas e2e

`pnpm e2e` abre la app en Google Chrome (el del sistema) y la recorre como lo haría una persona. La app se compila aparte (`.next-e2e`) y trabaja contra:

- **Supabase de pruebas**: un proyecto aparte, configurado en `.env.test`. Nunca contra producción: `e2e/entorno.ts` se niega a arrancar si `.env.test` apunta al mismo proyecto que `.env.local`.
- **Simulador de ElevenLabs y Calendly** (`e2e/simulador/servidor.mts`): un servidor local que responde como ellos y guarda cada petición para que las pruebas la comprueben. No se llama a ningún servicio real ni se gasta nada. Atiende por HTTPS en el puerto 3124, igual que los servicios reales, con un certificado autofirmado que se genera en `e2e/.certs/` (la app de pruebas lo acepta con `NODE_EXTRA_CA_CERTS`). El control de las pruebas va por HTTP en el 3125.
- **Marca blanca en local**: `BASE_DOMAIN=localhost`, así que `<slug>.localhost:3123` es el dominio de cada empresa. Chrome resuelve `*.localhost` sin tocar `/etc/hosts`.

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

## Qué cubren

- `recorrido-empresa.spec.ts`, en serie: alta de la empresa por el proveedor con invitación por enlace (en el dominio de la empresa); línea y tarifa; voz del catálogo, con su muestra MP3; el propietario elige contraseña; guion con voz; importación CSV; lote y pasada del motor (la llamada sale con su línea, su voz y el primer mensaje); fin de llamada por webhook firmado (y uno con firma falsa, rechazado); uso del mes; exportación de contactos y su auditoría; suspensión y baja, que borra sus conversaciones y deja el uso en la auditoría.
- `empresas.spec.ts`: aislamiento entre empresas (listado, ficha por URL directa, exportación); `/admin` solo para el proveedor; permisos del operador; marca blanca por dominio (marca propia, sin web pública ni `/admin`, sin entrada para usuarios de otra empresa, dominio desconocido); Calendly por OAuth con PKCE y tokens cifrados; marca de la plataforma, que se ve al momento y no rompe las páginas con parámetro al regenerarse.
- `web.spec.ts`: portada, textos legales como borrador y `/admin` sin sesión.

Una página «no existe» del panel se comprueba por su contenido y no por el código: el panel responde por partes (streaming) y, cuando la página decide que no existe, la cabecera ya salió con 200. Las que corta el proxy sí dan 404.

## Ejecutar

```
pnpm e2e                          # todas
pnpm e2e e2e/web.spec.ts          # un archivo
pnpm exec playwright show-report  # informe HTML del último fallo (con trazas)
```

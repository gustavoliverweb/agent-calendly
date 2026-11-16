# Agente de voz saliente con agenda en Calendly

Panel web para lanzar llamadas salientes con un agente de voz de ElevenLabs que agenda citas en Calendly. Plan completo en [`PLAN.md`](PLAN.md). Configuración de integraciones: [`docs/configuracion-calendly.md`](docs/configuracion-calendly.md) y [`docs/configuracion-elevenlabs.md`](docs/configuracion-elevenlabs.md); guion de ejemplo del agente en [`docs/system-prompt.md`](docs/system-prompt.md). Despliegue: [`docs/despliegue-render.md`](docs/despliegue-render.md). Tarea programada del motor de lotes: [`docs/configuracion-cron.md`](docs/configuracion-cron.md). Operación (avisos, rotar secretos, RGPD, retención): [`docs/runbook.md`](docs/runbook.md).

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth) en la nube · Render (Fráncfort) · ElevenLabs Agents · Calendly Scheduling API.

## Requisitos

- Node.js 24 y pnpm
- `psql` (opcional, para inspeccionar la base de datos)
- Un proyecto de Supabase en **Central EU (Frankfurt)**

> No se usa Supabase local con Docker: el desarrollo va contra el proyecto en la nube.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env.local      # y rellénalo (ver tabla de variables en .env.example)
pnpm exec supabase login        # una vez, abre el navegador
pnpm exec supabase link --project-ref <ref>
pnpm db:push                    # aplica las migraciones de supabase/migrations
pnpm db:types                   # regenera lib/supabase/database.types.ts
pnpm dev
```

### Configuración de Supabase Auth (panel de Supabase)

1. **Authentication → Sign In / Providers:** desactivar "Allow new users to sign up". Solo entran usuarios invitados.
2. **Authentication → URL Configuration:**
   - Site URL: `http://localhost:3000` en desarrollo; el dominio en producción.
   - Redirect URLs: `http://localhost:3000/**` y `https://<dominio>/**`.
3. **Authentication → Emails → Templates:** sustituir las plantillas **Invite user** y **Reset password** por el contenido de `supabase/templates/invite.html` y `supabase/templates/recovery.html`. Llevan al usuario a `/auth/confirm`, que inicia la sesión y le pide elegir contraseña.

### Empresas y usuarios

Cada usuario pertenece a una o varias **empresas** y solo ve los datos de ellas. Los datos que había antes del paso a multi-empresa están en la empresa `principal`.

- **Administración de la plataforma** (`/admin`, solo el proveedor): crear empresas e invitar a su propietario, suspender o reactivar, gestionar el equipo de cualquier empresa y ver el uso de los últimos 30 días. Se da acceso con `pnpm admin-plataforma <email>` a un usuario que ya existe.
- **Equipo** (`/app/equipo`, en cada empresa): el propietario invita, cambia el rol (propietario u operador) y quita miembros. Una empresa siempre conserva al menos un propietario.
- **Guion** (`/app/guion`, en cada empresa): el propietario redacta por apartados lo que el agente cuenta del negocio, más el nombre del agente y el primer mensaje (que debe identificarlo como IA y avisar de la transcripción). Cada vez que se guarda se crea una versión; la activa es la que usan las llamadas, y cada llamada guarda la suya. Sin guion activo no sale ninguna llamada. **Probar en el navegador** abre una conversación con el micrófono, con una versión y un contacto de la empresa, sin marcar ningún teléfono (la llamada queda en el panel como «Prueba»). 
- **Calendly** (`/app/calendly`, en cada empresa): el propietario conecta su cuenta con OAuth, elige el tipo de evento en el que reserva el agente y la app crea el webhook de la empresa. Los tokens se guardan cifrados (`ENCRYPTION_KEY`). Hasta que la empresa principal conecte la suya, usa el Calendly de las variables de entorno. Configuración de la app OAuth: [`docs/configuracion-calendly.md`](docs/configuracion-calendly.md#0-app-oauth-de-la-plataforma-una-vez).
- **Teléfono** (`/app/telefono`, solo lectura): la línea de la empresa (número SIP importado en ElevenLabs, que asigna el proveedor en `/admin`), los minutos del mes y las llamadas simultáneas contratadas. Sin línea se puede preparar todo y probar en el navegador, pero no llamar. En `/admin` el proveedor asigna la línea, fija los límites de cada empresa (llamadas simultáneas, minutos al mes) y la concurrencia global del plan de ElevenLabs, que el motor de lotes reparte entre empresas. Detalle: [`docs/configuracion-elevenlabs.md`](docs/configuracion-elevenlabs.md#líneas-de-las-empresas).

**Invitaciones sin email propio:** mientras Supabase Auth no tenga SMTP propio (su correo por defecto solo llega a los miembros del proyecto de Supabase), las invitaciones generan un **enlace de acceso** que el panel muestra para enviarlo a mano. Cuando haya SMTP, `INVITACIONES_POR_EMAIL=true` (en Render y en `.env.local`) hace que se envíen por correo. Conviene subir la caducidad de esos enlaces en **Authentication → Providers → Email → Email OTP Expiration** (máximo 86400 s = 24 h); si caduca, el equipo tiene la opción «Nuevo enlace de acceso».

Desde la terminal:

```bash
pnpm invitar persona@empresa.com [slug-empresa]
```

La empresa es obligatoria si hay más de una. El primer usuario de una empresa entra como propietario; los siguientes, como operadores. El usuario recibe un correo, pulsa el enlace, elige su contraseña (mínimo 10 caracteres) y entra al panel.

Mientras no haya SMTP propio para los correos de Auth, se puede crear el usuario directamente con una contraseña provisional:

```bash
pnpm crear-usuario persona@empresa.com [slug-empresa]
```

Muestra la contraseña una sola vez. Se cambia en `/cuenta/contrasena` tras entrar.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build y servidor de producción |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Calidad: ESLint, TypeScript, Vitest |
| `pnpm db:status` | Migraciones locales vs remotas |
| `pnpm db:dry-run` | Qué migraciones se aplicarían, sin aplicarlas |
| `pnpm db:push` | Aplica migraciones pendientes |
| `pnpm db:types` | Regenera los tipos de la base de datos |
| `pnpm db:test [migración.sql…]` | Pruebas de aislamiento entre empresas contra la base real, dentro de una transacción que se deshace. Con migraciones, las aplica antes en la misma transacción (para probarlas sin aplicarlas) |
| `pnpm invitar <email> [empresa]` · `pnpm crear-usuario <email> [empresa]` | Alta de un usuario del panel en una empresa |
| `pnpm admin-plataforma <email> [--quitar]` | Da o quita acceso a `/admin` |
| `pnpm calendly tipos` | Tipos de evento de Calendly (para `CALENDLY_EVENT_TYPE_URI`) |
| `pnpm calendly webhooks` · `crear-webhook <url>` · `borrar-webhook <uri>` | Suscripción del webhook de Calendly |
| `pnpm llamada-prueba <email\|teléfono\|id>` · `cerrar <id>` | Llamada de prueba para el tester web de ElevenLabs, con el guion activo de la empresa del contacto (no marca ningún teléfono). Desde el panel: Guion → Probar en el navegador |

`scripts/db.sh` conecta por el pooler en modo transacción (puerto **6543**), porque desde algunas redes o VPN el 5432 no responde. Nunca imprime la contraseña.

## Estructura

```
app/(auth)/login            Login con email y contraseña + recuperación
app/auth/confirm            Destino de los enlaces de invitación/recuperación
app/auth/salir              Cerrar sesión (POST)
app/cuenta/contrasena       Elegir/cambiar contraseña
app/(marketing)            Landing pública en / (secciones, demo de llamada, FAQ); componentes en components/landing
lib/marca.ts                Nombre, descripción y email de contacto de la marca (provisionales)
app/(panel)/app/…           Panel protegido en /app: resumen, contactos, llamadas, lotes, configuración
app/(panel)/app/contactos   Listado (filtros, búsqueda, selección), ficha, importación CSV
lib/contacts/               Teléfonos E.164, lectura de CSV, validación de importación (con tests)
app/api/tools/              Tools del agente: disponibilidad, agendar, no-llamar (Bearer TOOLS_SECRET)
app/api/webhooks/calendly   Citas creadas, canceladas y reprogramadas (firma HMAC)
app/api/webhooks/elevenlabs Fin de llamada (transcripción, análisis) y fallos al iniciarla (firma HMAC)
app/(panel)/app/llamadas    Listado con filtros y detalle con transcripción (se actualiza solo)
app/(panel)/app/lotes       Lotes con progreso; pausar, reanudar y cancelar
app/(panel)/app/configuracion Franjas, festivos, concurrencia, reintentos y tipo de campaña (+ pausa global en la cabecera)
app/(panel)/app/guion       Guion por empresa: formulario, versiones y prueba en el navegador (components/guion)
lib/guion/                  Montaje y validación del guion (con tests) y guion de cada llamada
app/(panel)/app/calendly    Conectar Calendly (OAuth), tipo de evento y desconectar (components/calendly)
app/api/calendly/oauth/     Inicio y vuelta del OAuth de Calendly (PKCE)
app/api/webhooks/calendly/[empresa] Webhook de Calendly de cada empresa
app/(panel)/app/telefono    Línea, uso del mes y límites (lib/telefono.ts; reparto en lib/calls/reparto.ts)
app/api/cron/despachar      Pasada del motor de lotes cada minuto (Bearer CRON_SECRET)
lib/calls/                  Lanzar llamadas (reglas + crear_llamada atómica), franjas, mapeo de resultados,
                            dispatcher de lotes y reconciliación de llamadas sin webhook
lib/lotes/                  Estados, etiquetas y consultas de lotes
lib/elevenlabs/             Cliente de la API (llamada saliente SIP, conversación)
lib/calendly/               Cliente, conexión por empresa (OAuth, tokens cifrados y renovación), huecos (caché 60 s), formato en español, reserva, webhook
lib/tools/                  Lógica de cada tool, separada de la ruta HTTP
lib/time/madrid.ts          Conversión Europe/Madrid ↔ UTC (cambios de horario incluidos)
scripts/fixtures/           CSV de 50 contactos del criterio de aceptación 1
proxy.ts                    Refresca la sesión y protege /app y /cuenta (antes "middleware")
lib/env.ts                  Variables de entorno validadas por grupos (Zod)
lib/supabase/               Clientes: server (sesión), admin (service role), client (navegador)
lib/log.ts                  Logger JSON que enmascara teléfonos y emails
supabase/migrations/        Esquema SQL (tablas, RLS, triggers, funciones)
supabase/templates/         Plantillas de correo de Auth
```

## Seguridad

- RLS activado en todas las tablas: `anon` no ve nada; los usuarios autenticados leen todo (un único negocio). Tools, webhooks y cron usan la service role, solo en el servidor.
- La lista de exclusión es permanente: un trigger impide sacar a un contacto de `no_llamar` y lo retira de los lotes pendientes.
- Los contactos solo se borran con `borrar_contacto_rgpd()`, que borra en cascada y deja auditoría sin datos personales; el panel borra también sus conversaciones en ElevenLabs.
- Retención: transcripciones y webhooks se purgan cada noche según los plazos de Configuración.
- Límite de peticiones en tools y cron; cabeceras de seguridad con CSP (`frame-ancestors 'none'`, `object-src 'none'`).
- La concurrencia la garantiza la BD: `crear_llamada()` y `reservar_llamadas_lote()` comparten un advisory lock, así que ni dos clics ni dos pasadas del cron superan `max_concurrencia`.
- Tools y cron: `Authorization: Bearer <TOOLS_SECRET>` / `<CRON_SECRET>` comparado en tiempo constante; webhooks con firma HMAC-SHA256, ventana anti-replay e idempotencia en `eventos_webhook`.
- Secretos solo en `.env.local` / Render; nunca en el cliente salvo la URL y la clave pública de Supabase, protegidas por RLS.

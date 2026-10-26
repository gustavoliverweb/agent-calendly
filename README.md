# Agente de voz saliente con agenda en Calendly

Panel web para lanzar llamadas salientes con un agente de voz de ElevenLabs que agenda citas en Calendly. Plan completo en [`PLAN.md`](PLAN.md). Configuración de integraciones: [`docs/configuracion-calendly.md`](docs/configuracion-calendly.md) y [`docs/configuracion-elevenlabs.md`](docs/configuracion-elevenlabs.md). Tarea programada del motor de lotes: [`docs/configuracion-cron.md`](docs/configuracion-cron.md). Operación (avisos, rotar secretos, RGPD, retención): [`docs/runbook.md`](docs/runbook.md).

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth) en la nube · Vercel (`fra1`) · ElevenLabs Agents · Calendly Scheduling API.

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

### Invitar usuarios

```bash
pnpm invitar persona@empresa.com
```

El usuario recibe un correo, pulsa el enlace, elige su contraseña (mínimo 10 caracteres) y entra al panel.

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
| `pnpm invitar <email>` | Invita a un usuario al panel |
| `pnpm calendly tipos` | Tipos de evento de Calendly (para `CALENDLY_EVENT_TYPE_URI`) |
| `pnpm calendly webhooks` · `crear-webhook <url>` · `borrar-webhook <uri>` | Suscripción del webhook de Calendly |

`scripts/db.sh` conecta por el pooler en modo transacción (puerto **6543**), porque desde algunas redes o VPN el 5432 no responde. Nunca imprime la contraseña.

## Estructura

```
app/(auth)/login            Login con email y contraseña + recuperación
app/auth/confirm            Destino de los enlaces de invitación/recuperación
app/auth/salir              Cerrar sesión (POST)
app/cuenta/contrasena       Elegir/cambiar contraseña
app/(panel)/…               Panel protegido: resumen, contactos, llamadas, lotes, configuración
app/(panel)/contactos       Listado (filtros, búsqueda, selección), ficha, importación CSV
lib/contacts/               Teléfonos E.164, lectura de CSV, validación de importación (con tests)
app/api/tools/              Tools del agente: disponibilidad, agendar, no-llamar (Bearer TOOLS_SECRET)
app/api/webhooks/calendly   Citas creadas, canceladas y reprogramadas (firma HMAC)
app/api/webhooks/elevenlabs Fin de llamada (transcripción, análisis) y fallos al iniciarla (firma HMAC)
app/(panel)/llamadas        Listado con filtros y detalle con transcripción (se actualiza solo)
app/(panel)/lotes           Lotes con progreso; pausar, reanudar y cancelar
app/(panel)/configuracion   Franjas, festivos, concurrencia, reintentos y tipo de campaña (+ pausa global en la cabecera)
app/api/cron/despachar      Pasada del motor de lotes cada minuto (Bearer CRON_SECRET)
lib/calls/                  Lanzar llamadas (reglas + crear_llamada atómica), franjas, mapeo de resultados,
                            dispatcher de lotes y reconciliación de llamadas sin webhook
lib/lotes/                  Estados, etiquetas y consultas de lotes
lib/elevenlabs/             Cliente de la API (llamada saliente SIP, conversación)
lib/calendly/               Cliente, huecos (caché 60 s), formato en español, reserva, webhook
lib/tools/                  Lógica de cada tool, separada de la ruta HTTP
lib/time/madrid.ts          Conversión Europe/Madrid ↔ UTC (cambios de horario incluidos)
scripts/fixtures/           CSV de 50 contactos del criterio de aceptación 1
proxy.ts                    Refresca la sesión y protege rutas (antes "middleware")
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
- Secretos solo en `.env.local` / Vercel; nunca en el cliente salvo la URL y la clave pública de Supabase, protegidas por RLS.

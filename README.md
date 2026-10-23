# Agente de voz saliente con agenda en Calendly

Panel web para lanzar llamadas salientes con un agente de voz de ElevenLabs que agenda citas en Calendly. Plan completo en [`PLAN.md`](PLAN.md).

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
- Los contactos solo se borran con `borrar_contacto_rgpd()`, que borra en cascada y deja auditoría sin datos personales.
- Secretos solo en `.env.local` / Vercel; nunca en el cliente salvo la URL y la clave pública de Supabase, protegidas por RLS.

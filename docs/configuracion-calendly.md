# Configuración de Calendly

La app consulta huecos y reserva citas con la API de Calendly. **La reserva por API (Scheduling API) solo funciona en planes de pago (Standard o superior)**; en el plan gratuito devuelve 403.

Desde la fase S4 **cada empresa conecta su propia cuenta** desde el panel (sección **Calendly**, botón «Conectar con Calendly»), elige el tipo de evento y la app crea su webhook sola. Para eso la plataforma necesita **una app OAuth** en Calendly (apartado 0). Los apartados 2–4 (token personal, `CALENDLY_EVENT_TYPE_URI`, webhook a mano) son el **Calendly de entorno**, transitorio: solo lo usa la empresa principal mientras no conecte su cuenta por OAuth.

## 0. App OAuth de la plataforma (una vez)

1. Con la cuenta de Calendly del proveedor, entra en **developer.calendly.com → Developer tools → OAuth apps → Create new app**. Conviene una app **Sandbox** para pruebas en local y otra **Production** para Render.
2. Datos de la app:
   - **Redirect URI** (solo se admite una): `https://<dominio>/api/calendly/oauth/callback`. En Sandbox también vale `http://localhost:3000/api/calendly/oauth/callback`; en Production solo `https`.
   - **Scopes**: `users:read`, `event_types:read`, `scheduled_events:read`, `scheduled_events:write`, `webhooks:read` y `webhooks:write`. Hay que marcar **también los `:read`**: aunque la documentación de Calendly dice que `:write` los incluye, en la práctica no es así (sin `scheduled_events:read`, crear el webhook falla con «missing required scope»). Si se añaden scopes a una app ya usada, cada empresa debe desconectar y volver a conectar. La app los pide también al autorizar (`CALENDLY_OAUTH_SCOPES`; si Calendly rechazara el parámetro, déjalo vacío y valdrán los marcados en la app).
3. Al crearla, Calendly muestra **una sola vez** el client ID, el client secret y la clave de firma de webhooks: guárdalos en `CALENDLY_OAUTH_CLIENT_ID`, `CALENDLY_OAUTH_CLIENT_SECRET` y `CALENDLY_OAUTH_WEBHOOK_SIGNING_KEY` (en `.env.local` y en Render). Si se pierde la clave de firma, hay que pedirla a `support+developer@calendly.com`.
4. Genera `ENCRYPTION_KEY` con `openssl rand -base64 32` (la misma en local y en Render si comparten base de datos). Cifra los tokens en la BD: **si se cambia, todas las empresas tienen que volver a conectar Calendly**.

Qué hace la app con cada empresa:

- Guarda el access token (2 h) y el refresh token **cifrados**. El refresh token es de un solo uso: la app renueva con un turno por empresa para que dos peticiones a la vez no lo invaliden. Si Calendly lo rechaza (`invalid_grant`: permiso retirado, contraseña cambiada…), la empresa queda «Desconectada» con un aviso y el agente ofrece llamar más tarde.
- Crea un webhook con alcance de usuario hacia `https://<dominio>/api/webhooks/calendly/<id de la empresa>` (eventos `invitee.created` e `invitee.canceled`), firmado con la clave de la app.
- Una cuenta de Calendly solo puede estar conectada a una empresa.
- La ubicación que envía al reservar es la primera del tipo de evento elegido.
- Si una reserva devuelve 403 (cuenta sin plan de pago), el panel lo avisa.

**Paso de la empresa principal al OAuth:** cuando conecte su cuenta y elija el tipo de evento, el webhook antiguo (`/api/webhooks/calendly`) deja de procesarse. Después, bórralo con `pnpm calendly webhooks` y `pnpm calendly borrar-webhook <uri>`, y se pueden quitar de Render las variables `CALENDLY_TOKEN`, `CALENDLY_EVENT_TYPE_URI`, `CALENDLY_WEBHOOK_SIGNING_KEY` y `CALENDLY_LOCATION*`.

## 1. Tipo de evento

Crea (o elige) en Calendly el tipo de evento que reservará el agente. Recomendaciones:

- **Una sola ubicación** (p. ej. "Llamada telefónica: yo llamo al invitado", o una dirección fija). Con OAuth la app la lee del tipo de evento; con el Calendly de entorno hay que indicarla **siempre** en `CALENDLY_LOCATION_KIND` (y `CALENDLY_LOCATION` si la ubicación lleva texto). Sin ella, Calendly rechaza la reserva por API con `invalid_location_choice` aunque el tipo de evento tenga una sola ubicación. Valores habituales: `google_conference` (Google Meet), `zoom_conference`, `physical` (con la dirección en `CALENDLY_LOCATION`), `outbound_call` (el anfitrión llama; la app envía el teléfono del contacto).
- **Sin preguntas obligatorias**: la reserva por API fallaría si falta alguna.
- Horario, duración, antelación mínima y descansos se configuran **en Calendly**: la app no los duplica, solo ofrece lo que Calendly da como libre. Además, la app no ofrece huecos que empiecen en menos de 2 horas.

## 2. Token y tipo de evento

1. Calendly → **Integrations → API & Webhooks → Personal Access Tokens → Generate new token**.
2. Copia el token en `.env.local` como `CALENDLY_TOKEN`.
3. Ejecuta:

   ```bash
   pnpm calendly tipos
   ```

   Muestra cada tipo de evento con su `CALENDLY_EVENT_TYPE_URI`, sus ubicaciones y avisos si tiene varias ubicaciones o preguntas obligatorias. Copia la URI del tipo elegido a `.env.local`.

## 3. Webhook (cuando la app esté desplegada)

Calendly avisa a la app cuando una cita se cancela o se reprograma (también si se reserva desde fuera del agente).

1. `CALENDLY_WEBHOOK_SIGNING_KEY` debe estar en `.env.local` **y en Render** con el mismo valor (`openssl rand -hex 32` si no existe).
2. Con la app ya en producción:

   ```bash
   pnpm calendly crear-webhook https://<dominio>/api/webhooks/calendly
   pnpm calendly webhooks          # comprobar que está "active"
   ```

Para cambiar la URL: `pnpm calendly borrar-webhook <uri>` y volver a crearla.

## 4. Variables en Render

`CALENDLY_TOKEN`, `CALENDLY_EVENT_TYPE_URI`, `CALENDLY_WEBHOOK_SIGNING_KEY` y, si hacen falta, `CALENDLY_LOCATION_KIND` / `CALENDLY_LOCATION`. `CALENDLY_API_BASE` **no** se define en producción (solo sirve para pruebas con un Calendly simulado).

## Qué hace la app con cada evento

| Evento | Efecto |
|---|---|
| Reserva hecha por el agente | Cita `activa`, llamada con `cita_agendada`, contacto en `cita_agendada` y email guardado |
| `invitee.created` de una cita ya registrada | Nada (idempotente) |
| `invitee.created` con `old_invitee` (reprogramación) | Cita nueva `activa` enlazada a la anterior, que pasa a `reprogramada`; la llamada apunta a la nueva fecha |
| `invitee.created` desde fuera del agente | Si el email o teléfono coincide con un contacto, se registra la cita; si no, solo queda en `eventos_webhook` |
| `invitee.canceled` con `rescheduled = true` | Cita `reprogramada` (la nueva llega en su `invitee.created`) |
| `invitee.canceled` | Cita `cancelada` con motivo; si al contacto no le quedan citas activas, vuelve a `llamado` con seguimiento "cita_cancelada" |
| Eventos de otros tipos de evento del calendario | Se ignoran |

## Tools para ElevenLabs (fase 4)

Todas son `POST` con cabecera `Authorization: Bearer <TOOLS_SECRET>` y responden siempre 200 con un `mensaje` pensado para que el agente sepa qué decir.

| Tool | URL | Parámetros |
|---|---|---|
| disponibilidad | `/api/tools/disponibilidad` | `desde`, `hasta` (opcionales, `AAAA-MM-DD` en hora de Madrid), `llamada_id` (variable dinámica) |
| agendar | `/api/tools/agendar` | `start_time` (exacto de un hueco), `nombre`, `email`, `llamada_id` (variable dinámica) |
| no_llamar | `/api/tools/no-llamar` | `llamada_id` (variable dinámica) |

Errores que devuelve `agendar` en `error`: `hueco_no_disponible`, `email_invalido`, `fecha_invalida`, `ya_tiene_cita`, `llamada_no_encontrada`, `no_permitido`, `calendario_no_disponible`.

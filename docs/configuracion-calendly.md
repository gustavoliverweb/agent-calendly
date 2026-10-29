# Configuración de Calendly

La app consulta huecos y reserva citas con la API de Calendly. **La reserva por API (Scheduling API) solo funciona en planes de pago (Standard o superior)**; en el plan gratuito devuelve 403.

## 1. Tipo de evento

Crea (o elige) en Calendly el tipo de evento que reservará el agente. Recomendaciones:

- **Una sola ubicación** (p. ej. "Llamada telefónica: yo llamo al invitado", o una dirección fija). Si tiene varias, hay que indicar cuál con `CALENDLY_LOCATION_KIND` (y `CALENDLY_LOCATION` si la ubicación lleva texto).
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

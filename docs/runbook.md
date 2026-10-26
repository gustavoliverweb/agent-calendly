# Runbook de operación

Qué hacer ante las situaciones habituales con el panel en producción. Los avisos del **Resumen** son el primer sitio donde mirar.

## Parar todo de inmediato

Botón **Pausa global** de la cabecera, en cualquier página.

- Deja de lanzarse cualquier llamada nueva, tanto de los lotes como manual.
- Las llamadas que ya están sonando terminan con normalidad.
- Para reanudar, el mismo botón, que pide confirmación.

Si el panel no carga, se puede hacer en Supabase → SQL Editor:

```sql
update public.configuracion set pausa_global = true where id = 1;
```

## Avisos del Resumen

| Aviso | Causa probable | Qué hacer |
|---|---|---|
| La tarea programada no se ejecuta | El job `despachar-llamadas` de pg_cron está parado, o `CRON_SECRET` no coincide | Revisar `cron.job_run_details` y `net._http_response` ([configuracion-cron.md](configuracion-cron.md)). Un 401 indica que el secreto de Vault y el de Vercel son distintos. |
| Llamadas que no pudieron iniciarse | ElevenLabs caído, sin saldo, línea SIP caída o agente mal configurado | Ver `motivo_fallo` en Llamadas → Fallidas (`api: ElevenLabs respondió 4xx/5xx`). Si son 401/403, la `ELEVENLABS_API_KEY` es incorrecta. Si se repiten, activar la pausa global hasta resolverlo. |
| Avisos sin poder procesar | Fallo de la base de datos o un payload inesperado | Ver la columna `error` de `eventos_webhook` (SQL Editor). ElevenLabs y Calendly reintentan solos; un mismo aviso nunca se aplica dos veces. |
| Calendly no respondió | Calendly caído o token caducado | Comprobar `CALENDLY_TOKEN` (`pnpm calendly tipos`). Los contactos afectados quedan en "Requieren seguimiento" para llamarles a mano. |

## Rotar secretos

Cambiar siempre el secreto **en los dos lados a la vez**, y redesplegar en Vercel para que se aplique.

| Secreto | Dónde más hay que cambiarlo |
|---|---|
| `TOOLS_SECRET` | ElevenLabs → agente → Tools → cabecera `Authorization: Bearer …` de las 3 tools (están guardadas como secreto) |
| `CRON_SECRET` | Supabase: `select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), 'NUEVO');` |
| `ELEVENLABS_WEBHOOK_SECRET` | ElevenLabs → Settings → Webhooks. Hay que regenerar el webhook y copiar el nuevo secreto. |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | Hay que recrear la suscripción (`pnpm calendly borrar-webhook` y luego `crear-webhook`) con la nueva clave |
| `ELEVENLABS_API_KEY`, `CALENDLY_TOKEN` | Solo en Vercel. Revocar la clave antigua en el proveedor. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → regenerar. Afecta a todo el servidor. |

Generar un secreto nuevo: `openssl rand -hex 32`.

Para que no haya llamadas a medias, conviene rotar con la **pausa global** activada. Las tools fallarían con 401 durante los segundos en que los dos lados no coinciden.

## Derecho de supresión (RGPD)

Ficha del contacto → **Borrar contacto**. Borra:

- el contacto, sus llamadas, transcripciones, citas e items de lote (en cascada);
- sus conversaciones en ElevenLabs (transcripción y audio).

Si ElevenLabs falla, el borrado local se hace igualmente, y los IDs que quedan pendientes se guardan en la auditoría:

```sql
select creado_en, detalle->'pendientes' as pendientes
  from public.auditoria
 where accion = 'borrar_conversaciones_elevenlabs'
   and jsonb_array_length(detalle->'pendientes') > 0
 order by creado_en desc;
```

Cada pendiente se borra a mano en ElevenLabs → Agents → Conversations, o con:

```bash
curl -X DELETE https://api.elevenlabs.io/v1/convai/conversations/CONVERSATION_ID -H "xi-api-key: $ELEVENLABS_API_KEY"
```

**La cita de Calendly no se toca**, porque es un evento real del calendario del negocio. Si el interesado pide borrarla, se cancela desde Calendly. Para borrar sus datos de invitado, Calendly solo ofrece la API de borrado de datos en el plan Enterprise; en otro plan, hay que pedírselo a su soporte.

## Retención de datos

Cada noche, con la tarea programada, se borran:

- la transcripción, el resumen y los datos recogidos de las llamadas que superan el plazo, que por defecto es de **365 días**;
- los avisos recibidos (`eventos_webhook`) de más de **30 días**.

Los plazos se cambian en Configuración → Conservación de datos.

Se conservan el estado, la duración y la cita de cada llamada, que alimentan los indicadores.

Cada purga que borra algo queda en la auditoría (`accion = 'purga_retencion'`).

## Límites de peticiones

- **Tools:**
  - 300 peticiones por minuto por tool y por instancia; por encima, responden 429.
  - Un token incorrecto da 401, y a partir de 20 intentos por minuto desde la misma IP, 429.
- **Cron:** mismo límite para el token incorrecto.

Un 429 en uso normal indicaría tráfico anómalo, y probablemente un secreto filtrado: en ese caso, rotarlo.

## Consultas útiles

```sql
-- Llamadas abiertas ahora mismo
select id, estado, creado_en, lote_id from public.llamadas where estado in ('iniciada', 'en_curso');

-- Tiempo entre el fin de la llamada y la llegada del webhook (criterio: < 1 min)
select percentile_cont(0.95) within group (order by extract(epoch from webhook_recibido_en - finalizada_en)) as p95_seg
  from public.llamadas
 where webhook_recibido_en is not null and creado_en > now() - interval '7 days';

-- Fallos por motivo en los últimos 7 días
select coalesce(motivo_fallo, clasificacion) as motivo, count(*)
  from public.llamadas
 where estado in ('fallida', 'buzon') and creado_en > now() - interval '7 days'
 group by 1 order by 2 desc;
```

Los logs de Vercel son JSON, con los teléfonos y emails enmascarados. Para seguir una llamada, filtrar por `llamada_id` o `conversation_id`.

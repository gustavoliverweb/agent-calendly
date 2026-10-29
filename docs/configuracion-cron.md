# Motor de lotes: tarea programada

El motor de lotes avanza solo en tres momentos:

1. al crear o reanudar un lote, o al quitar la pausa global;
2. al recibir el webhook de fin de una llamada de un lote (se libera un hueco);
3. **cada minuto**, con una tarea programada que llama a `POST /api/cron/despachar`.

La tercera es la que hace falta configurar. Sin ella, los lotes funcionan mientras haya actividad, pero no arrancan solos al abrir la franja horaria, los reintentos programados no se lanzan y las llamadas que se quedan sin webhook no se reconcilian.

Cada pasada hace lo siguiente:

1. Reconcilia las llamadas abiertas más de `timeout_llamada_min`: consulta a ElevenLabs y las cierra con lo que haya; si no hay nada, como fallidas por `timeout`.
2. Si hay pausa global, está fuera de franja o es festivo, no lanza nada.
3. Reclama tantos contactos como huecos libres haya y los llama. Lo hace la función SQL `reservar_llamadas_lote()`, bajo el mismo bloqueo que las llamadas manuales, así que nunca se supera `max_concurrencia`.
4. Cierra como completados los lotes que ya no tienen nada pendiente.
5. Una vez al día, purga los datos que superan los plazos de retención (Configuración → Conservación de datos).
6. Registra su latido. Si hay lotes activos y no hay latido en 5 minutos, el Resumen avisa de que la tarea no se está ejecutando.

Es seguro llamarla varias veces a la vez.

## Opción recomendada: Supabase `pg_cron` + `pg_net`

No depende del alojamiento: la base de datos llama cada minuto a la URL pública de la app. Se configura una vez, cuando la app ya está desplegada, en **Supabase → SQL Editor**:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secretos en Vault (no quedan en texto plano en la definición del job).
select vault.create_secret('https://TU-DOMINIO', 'app_url');
select vault.create_secret('EL_MISMO_CRON_SECRET_QUE_EN_RENDER', 'cron_secret');

select cron.schedule(
  'despachar-llamadas',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/despachar',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
```

Para comprobarlo:

```sql
-- Últimas ejecuciones del job
select status, return_message, start_time
  from cron.job_run_details
 order by start_time desc
 limit 5;

-- Respuestas HTTP de la app (200 con el resumen; 401 = CRON_SECRET distinto)
select status_code, content, created
  from net._http_response
 order by created desc
 limit 5;
```

Para cambiar el secreto: `select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), 'NUEVO');`. Para pararlo: `select cron.unschedule('despachar-llamadas');`.

## Probarlo a mano

```bash
curl -X POST https://TU-DOMINIO/api/cron/despachar -H "Authorization: Bearer $CRON_SECRET"
# {"lanzadas":0,"fallidas":0,"reconciliadas":0,"lotesCerrados":0,"parado":"fuera_de_franja"}
```

`parado` indica por qué no se ha lanzado nada: `pausa_global`, `fuera_de_franja` o `sin_configurar` (faltan las claves de ElevenLabs).

## Reglas de los lotes

- **Al crear el lote** se omiten, con su motivo visible en el panel: los contactos en "no llamar", los que ya tienen cita, los que no tienen consentimiento (si la campaña es comercial) y los que ya están en otro lote activo o pausado.
- **Al llamar** se vuelve a comprobar todo lo anterior. Si alguien pasa a "no llamar" con el lote en marcha, no se le llama.
- **No contesta, comunica o salta el buzón:** se reintenta a las `horas_entre_reintentos`, ajustado al siguiente inicio de franja. Con los reintentos agotados (`1 + max_reintentos` intentos), el item queda como "Sin éxito" y el contacto como "no contesta".
- **Error de ElevenLabs al iniciar la llamada:** no cuenta como intento del contacto.
  - Un error temporal (5xx, 408 o 429) se reintenta a los 10 minutos.
  - Un error permanente (otro 4xx, como un número rechazado) abandona el item.
- **Pausar un lote** deja de lanzar llamadas nuevas; las que están sonando terminan. **Cancelarlo** además retira lo que quedaba pendiente. La **pausa global** (botón de la cabecera) detiene todos los lotes y las llamadas manuales.

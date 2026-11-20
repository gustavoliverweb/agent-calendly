# Runbook de operación

Qué hacer ante las situaciones habituales con el panel en producción. Los avisos del **Resumen** son el primer sitio donde mirar. Para dar de alta una empresa nueva, sigue la [guía de alta](guia-alta.md).

## Parar todo de inmediato

Botón **Pausa global** de la cabecera del panel, en cualquier página. Afecta solo a la empresa desde la que se pulsa.

- Deja de lanzarse cualquier llamada nueva de esa empresa, tanto de los lotes como manual.
- Las llamadas que ya están sonando terminan con normalidad.
- Para reanudar, el mismo botón, que pide confirmación.

Si el panel no carga, o hay que parar **todas** las empresas a la vez, se hace en Supabase → SQL Editor:

```sql
-- Una empresa
update public.configuracion set pausa_global = true
 where empresa_id = (select id from public.empresas where slug = 'identificador-de-la-empresa');

-- Toda la plataforma
update public.configuracion set pausa_global = true;
```

Para reanudar, lo mismo con `false`. Ojo: reanudar toda la plataforma quita también la pausa de las empresas que la tenían puesta por su cuenta.

## Avisos del Resumen

| Aviso | Causa probable | Qué hacer |
|---|---|---|
| La tarea programada no se ejecuta | El job `despachar-llamadas` de pg_cron está parado, o `CRON_SECRET` no coincide | Revisar `cron.job_run_details` y `net._http_response` ([configuracion-cron.md](configuracion-cron.md)). Un 401 indica que el secreto de Vault y el de Render son distintos. |
| Llamadas que no pudieron iniciarse | ElevenLabs caído, sin saldo, línea SIP caída o agente mal configurado | Ver `motivo_fallo` en Llamadas → Fallidas (`api: ElevenLabs respondió 4xx/5xx`). Si son 401/403, la `ELEVENLABS_API_KEY` es incorrecta. Si se repiten, activar la pausa global hasta resolverlo. |
| Avisos sin poder procesar | Fallo de la base de datos o un payload inesperado | Ver la columna `error` de `eventos_webhook` (SQL Editor). ElevenLabs y Calendly reintentan solos; un mismo aviso nunca se aplica dos veces. |
| Calendly no respondió | Calendly caído o token caducado | Comprobar `CALENDLY_TOKEN` (`pnpm calendly tipos`). Los contactos afectados quedan en "Requieren seguimiento" para llamarles a mano. |

## Rotar secretos

Cambiar siempre el secreto **en los dos lados a la vez**, y guardar el cambio en Render (Environment → *Save, rebuild, and deploy*) para que se aplique.

| Secreto | Dónde más hay que cambiarlo |
|---|---|
| `TOOLS_SECRET` | ElevenLabs → agente → Tools → cabecera `Authorization: Bearer …` de las 3 tools (están guardadas como secreto) |
| `CRON_SECRET` | Supabase: `select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), 'NUEVO');` |
| `ELEVENLABS_WEBHOOK_SECRET` | ElevenLabs → Settings → Webhooks. Hay que regenerar el webhook y copiar el nuevo secreto. |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | Hay que recrear la suscripción (`pnpm calendly borrar-webhook` y luego `crear-webhook`) con la nueva clave |
| `ELEVENLABS_API_KEY`, `CALENDLY_TOKEN` | Solo en Render. Revocar la clave antigua en el proveedor. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → regenerar. Afecta a todo el servidor. |

Generar un secreto nuevo: `openssl rand -hex 32`.

Para que no haya llamadas a medias, conviene rotar con la **pausa global** activada. Las tools fallarían con 401 durante los segundos en que los dos lados no coinciden.

### ENCRYPTION_KEY

Cifra los tokens de Calendly de todas las empresas. No se puede rotar sin más: si se cambia, los tokens guardados no se pueden descifrar y **cada empresa tiene que volver a conectar Calendly** desde su panel. Si se filtra, cambia la clave, revoca el client secret de la app OAuth en Calendly (Developer tools) y avisa a las empresas para que reconecten.

## Alta de la línea de una empresa

1. La empresa envía los datos de su troncal SIP (operador, número, servidor/dominio, usuario, contraseña) por un canal seguro (no por email en claro).
2. ElevenLabs → **Phone numbers → Import number → SIP trunk**.
3. `/admin` → empresa → **Línea, límites y tarifa**: elegir el número y guardar. La empresa ve «Activa» en su sección Teléfono.
4. Lanzar una llamada de prueba a un teléfono propio desde la ficha de un contacto.

## Límites de uso

- **Concurrencia global** (`/admin`, arriba): las conversaciones simultáneas del plan de ElevenLabs. Si se supera, ElevenLabs cobra tarifa «burst»; la app no lanza más de esas.
- **Por empresa** (ficha en `/admin`): llamadas simultáneas contratadas (la empresa puede configurar menos) y minutos al mes. Al llegar al límite de minutos no sale ninguna llamada (tampoco pruebas) hasta el mes siguiente, y la empresa lo ve en el panel. Las llamadas en curso al alcanzarlo terminan normalmente.

## Facturar el uso del mes

1. Fijar la **tarifa por minuto** (EUR) de cada empresa en su ficha de `/admin` (**Línea, límites y tarifa**). Sin tarifa, la empresa solo ve minutos y su importe no suma en el total.
2. A principio de mes, `/admin` → **Uso y facturación** → mes anterior → **CSV para facturar**: una fila por empresa con llamadas, contestadas, citas (y cuántas se cancelaron), minutos de llamadas y de pruebas, límite, tarifa, importe estimado y coste estimado de ElevenLabs (`COSTE_MINUTO_ESTIMADO`, USD).
3. Si una empresa pide el justificante, **Detalle** descarga sus llamadas del mes (fecha, tipo, estado, resultado, duración, cita) sin nombres ni teléfonos. La empresa puede descargar el mismo CSV desde su sección **Uso**.

Criterios: mes natural en la zona horaria de la empresa; los minutos son la suma de segundos de conversación / 60 (sin redondear cada llamada al minuto) e incluyen las pruebas en el navegador, igual que el límite mensual. El CSV usa «;» y coma decimal (Excel en español).

## Marca de la plataforma

`/admin/marca`: nombre, descripción, email de contacto, logo y favicon de la web pública, la pantalla de acceso y `/admin`. Un campo vacío usa el valor por defecto de `lib/marca.ts`. Al guardar, la web lo muestra al momento.

La web pública es estática: la marca se lee en caché y se renueva sola cada hora. Si la base de datos no responde (por ejemplo, durante un despliegue), la web sale con la marca por defecto como mucho durante esa hora.

El email de contacto se usa también como email del titular en los textos legales, salvo que `lib/legal.ts` tenga uno propio. Mientras sea el de ejemplo (`hola@example.com`), los textos legales lo marcan como pendiente.

## Catálogo de voces

`/admin/voces`: las voces que cada empresa puede elegir en su guion, además de la voz por defecto del agente. Se añaden desde las voces de la cuenta de ElevenLabs. Las de la biblioteca hay que guardarlas antes en la cuenta («Add to my voices»).

Requisitos en ElevenLabs:

- La clave de la API necesita el permiso **Voices → Read**. Sin él, la lista de voces da un error que lo explica.
- El agente tiene que permitir cambiar la voz: **Security → Overrides → Voice**. La página avisa si no está activado. Sin ese permiso, las llamadas de las empresas que elijan otra voz fallan.

Desactivar una voz la quita del selector, pero las empresas que ya la usan siguen llamando con ella. Solo se puede quitar del catálogo una voz que no use ninguna empresa en su guion activo.

## Dominio propio de una empresa (marca blanca)

1. La empresa crea en su DNS un **CNAME** de un subdominio (p. ej. `llamadas.empresa.com`) hacia el host `onrender.com` del servicio (lo muestra la ficha en `/admin`) y borra los registros AAAA de ese nombre. Mejor subdominio que dominio raíz: el raíz necesita registros A y Render le añade el `www`.
2. `/admin` → empresa → **Dominios** → Añadir.
   - Con `RENDER_API_KEY` y `RENDER_SERVICE_ID`, se añade solo al servicio de Render. «Comprobar» consulta su verificación.
   - Sin ellas, añádelo también en Render (servicio → Settings → Custom Domains). «Comprobar» solo mira el DNS.
3. Cuando aparece «Verificado», sus usuarios entran por `https://llamadas.empresa.com`: ven su logo y color, y los enlaces de invitación nuevos usan ese dominio. La sesión es por dominio, así que la primera vez hay que iniciar sesión de nuevo.
4. La empresa rellena su **Marca** (logo, color, datos legales). Sus páginas legales siguen marcadas como borrador hasta que tenga los datos obligatorios y el asesor revise los textos (`TEXTOS_REVISADOS`).

Notas:
- **Calendly**: «Conectar» en el dominio de una empresa pasa por el dominio de la plataforma (la redirect URI de la app OAuth sigue siendo `APP_URL/api/calendly/oauth/callback`) y vuelve al de la empresa.
- **Subdominios de la plataforma** (cuando haya marca y dominio propios): con `BASE_DOMAIN=<dominio>`, cada empresa entra también por `<slug>.<dominio>`. Hacen falta un dominio comodín `*.<dominio>` en Render (CNAME `*`, `_acme-challenge` y `_cf-custom-hostname`, según Render) y que el dominio raíz apunte también a Render.
- **Correo** (cuando haya SMTP): los enlaces de los correos de Supabase apuntan al dominio de la empresa, así que cada dominio debe estar en Supabase → Authentication → URL Configuration → Redirect URLs (`https://llamadas.empresa.com/**`). Los enlaces copiados desde el panel no lo necesitan.
- Plan Pro de Render: 15 dominios incluidos por workspace, y cada dominio extra cuesta 0,25 $/mes.

## Calendly desconectado en una empresa

En `/admin` aparece «Calendly: desconectado» y la empresa ve el aviso en su sección Calendly. Pasa cuando Calendly retira el permiso (el usuario cambió la contraseña o el email de acceso, revocó la app, o se perdió un refresh token). Solución: el propietario pulsa «Volver a conectar»; si es la misma cuenta, conserva el tipo de evento.

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

## Baja de una empresa

Se hace desde la ficha de la empresa en `/admin` (guía de alta, punto 6). Cada baja queda en la auditoría de la plataforma, con `empresa_id` nulo para que no la borre la cascada, junto con lo borrado, el uso mensual agregado (sin datos personales, para facturar) y lo que quedó pendiente:

```sql
select creado_en, detalle->>'slug' as empresa, detalle->'borrados' as borrados,
       detalle->'uso_mensual' as uso, detalle->'pendientes' as pendientes
  from public.auditoria
 where accion = 'borrar_empresa'
 order by creado_en desc;
```

Pendientes posibles:

- **`conversaciones`**: IDs que ElevenLabs no borró. Se borran como en [Derecho de supresión](#derecho-de-supresión-rgpd).
- **`dominios`**: quítalos en Render → Settings → Custom Domains.
- **`calendly: true`**: no se pudo revocar el acceso. Los avisos que siga enviando su webhook se ignoran (la empresa ya no existe), pero conviene pedir a la empresa que quite la app en Calendly → Integraciones.

Si el borrado falla a mitad, se puede repetir: los pasos externos ya hechos no fallan la segunda vez.

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

Los logs de Render (servicio → *Logs*) son JSON, con los teléfonos y emails enmascarados. Para seguir una llamada, filtrar por `llamada_id` o `conversation_id`.

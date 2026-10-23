# Configuración de ElevenLabs

Lo que la app espera del agente de ElevenLabs. El guion (system prompt) lo aporta el negocio; este documento recoge solo la parte técnica que debe coincidir con el código.

## Variables de entorno

| Variable | De dónde sale |
|---|---|
| `ELEVENLABS_API_KEY` | Perfil → API keys (permiso de Conversational AI) |
| `ELEVENLABS_AGENT_ID` | URL o ajustes del agente |
| `ELEVENLABS_PHONE_NUMBER_ID` | Phone numbers → número SIP importado |
| `ELEVENLABS_WEBHOOK_SECRET` | Se muestra al crear el webhook post-llamada |

## Variables dinámicas que envía la app en cada llamada

| Variable | Ejemplo | Uso |
|---|---|---|
| `nombre` | `María López` | Saludo |
| `llamada_id` | uuid | **Obligatoria en las tools** (valor desde variable dinámica, no lo rellena el LLM) |
| `contacto_id` | uuid | Referencia |
| `telefono` | `+34600112233` | Referencia |
| `email` | `maria@example.com` o vacío | Confirmar el correo antes de reservar |
| `tiene_email` | `true` / `false` | Si es `false`, pedir y deletrear el correo |
| `negocio` | `NEGOCIO_NOMBRE` | Presentación |
| `ahora_madrid` | `viernes 23 de octubre de 2026, 11:15` | Interpretar "mañana", "el jueves"… |

En el tester web de ElevenLabs hay que dar valores de prueba a todas.

## Tools (webhook, método POST)

Cabecera `Authorization: Bearer <TOOLS_SECRET>` (guardada como secreto en ElevenLabs). Las tres responden siempre 200 con un `mensaje` que el agente debe seguir.

| Tool | URL | Parámetros |
|---|---|---|
| `disponibilidad` | `https://<dominio>/api/tools/disponibilidad` | `desde`, `hasta` (opcionales, `AAAA-MM-DD`), `llamada_id` ← variable dinámica |
| `agendar` | `https://<dominio>/api/tools/agendar` | `start_time` (el exacto de un hueco), `nombre`, `email`, `llamada_id` ← variable dinámica |
| `no_llamar` | `https://<dominio>/api/tools/no-llamar` | `llamada_id` ← variable dinámica |

Detalle de respuestas y errores: [configuracion-calendly.md](configuracion-calendly.md#tools-para-elevenlabs-fase-4).

## Webhook post-llamada

- URL: `https://<dominio>/api/webhooks/elevenlabs`
- Eventos: **transcripción** (`post_call_transcription`) y **fallo al iniciar la llamada** (`call_initiation_failure`). El audio no se suscribe: la app no lo guarda.
- La app verifica la firma (`ElevenLabs-Signature`, 30 min de margen), ignora duplicados y, si el webhook llega antes de que la llamada tenga `conversation_id`, lo aplica en cuanto lo tiene.

## Data collection (análisis post-llamada)

La app lee estos identificadores exactos. Si no existen, la llamada se clasifica igual, pero con menos detalle.

| ID | Tipo | Descripción para el LLM |
|---|---|---|
| `interes` | string | `si`, `no` o `dudoso`: ¿el contacto mostró interés en la cita? |
| `motivo_rechazo` | string | Si no le interesa, por qué (breve) |
| `pide_rellamada` | boolean | ¿Pidió que le llamen en otro momento? |
| `momento_rellamada` | string | Cuándo pidió que le llamen ("el jueves por la tarde") |
| `pide_no_llamar` | boolean | ¿Pidió no volver a ser llamado? |
| `email_confirmado` | string | Email que confirmó durante la llamada |

Criterio de evaluación recomendado: `cita_agendada` — "¿Se reservó con éxito una cita mediante la tool agendar?" (solo informativo; la app usa lo que guardó la tool).

## Cómo clasifica la app cada llamada

La primera regla que se cumple gana (plan §7.2):

1. Pidió no ser llamado (tool `no_llamar` o `pide_no_llamar`) → contacto en **no llamar** (permanente).
2. Se reservó cita → **cita agendada**.
3. `interes = no` → **no interesado**.
4. No contestó, ocupado, buzón o nadie habló → suma un intento; agotados `1 + max_reintentos` → **no contesta**.
5. Habló sin resultado → **llamado**; si pidió rellamada, queda marcado para seguimiento con el momento indicado.

## Tools de sistema recomendadas

- `end_call` (colgar).
- **Detección de buzón de voz** activada, con la acción de colgar sin dejar mensaje. La app la reconoce por el motivo de fin de llamada.

# Configuración de ElevenLabs

Lo que la app espera del agente de ElevenLabs. Hay **un solo agente para todas las empresas**: su system prompt tiene la parte técnica y legal, que es fija, y el guion de cada empresa le llega en cada conversación como variable dinámica (`{{guion_negocio}}`). Cada empresa edita su guion en el panel (sección **Guion**). El prompt fijo, listo para copiar, está en [system-prompt.md](system-prompt.md).

## Variables de entorno

| Variable | De dónde sale |
|---|---|
| `ELEVENLABS_API_KEY` | Perfil → API keys (permiso de Conversational AI) |
| `ELEVENLABS_AGENT_ID` | URL o ajustes del agente |
| `ELEVENLABS_PHONE_NUMBER_ID` | Transitorio: línea de la empresa principal mientras no tenga una asignada en `/admin`. La de cada empresa se guarda en la BD (ver [Líneas](#líneas-de-las-empresas)) |
| `ELEVENLABS_WEBHOOK_SECRET` | Se muestra al crear el webhook post-llamada |

## Líneas de las empresas

Cada empresa llama desde su propia línea SIP (S5):

1. La empresa contrata una troncal SIP con su operador y envía al proveedor los datos de conexión (servidor/dominio SIP, usuario, contraseña, número).
2. El proveedor la importa en ElevenLabs: **Phone numbers → Import number → SIP trunk**, con esos datos.
3. En `/admin` → ficha de la empresa → **Línea y límites**, elige el número en la lista (la app la lee de ElevenLabs) y guarda. Un número solo puede estar en una empresa.

Sin línea, la empresa puede preparar todo y probar el agente en el navegador; las llamadas por teléfono y los lotes esperan.

**Concurrencia:** la del plan de ElevenLabs es una para toda la plataforma. Se fija en `/admin` («Llamadas simultáneas de la plataforma») y el motor de lotes la reparte entre las empresas con cola. Además, cada empresa tiene sus llamadas simultáneas contratadas (tope de lo que configure) y, si se quiere, un límite de minutos al mes.

## Primer mensaje y voz

- **First message** del agente: exactamente `{{primer_mensaje}}`. La app lo envía ya montado, con el nombre del contacto, el del negocio y el del agente. Así no hace falta activar la override del primer mensaje.
- **Voz:** la configurada en el agente. Cuando haya varias voces para elegir (lista `VOCES` de `lib/guion/guion.ts`), la app enviará la voz como override: antes hay que activar **Security → Overrides → Voice** en el agente; si no, ElevenLabs rechaza la conversación.

## Variables dinámicas que envía la app en cada llamada

| Variable | Ejemplo | Uso |
|---|---|---|
| `nombre` | `María López` | Saludo |
| `llamada_id` | uuid | **Obligatoria en las tools** (valor desde variable dinámica, no lo rellena el LLM) |
| `contacto_id` | uuid | Referencia |
| `telefono` | `+34600112233` | Referencia |
| `email` | `maria@example.com` o vacío | Confirmar el correo antes de reservar |
| `tiene_email` | `true` / `false` | Si es `false`, pedir y deletrear el correo |
| `negocio` | `Clínica Sonrisa` | Nombre del negocio (del guion de la empresa) |
| `nombre_agente` | `Clara` | Cómo se llama el agente (del guion) |
| `primer_mensaje` | `Hola, ¿hablo con María?…` | First message, ya montado |
| `guion_negocio` | texto de varios apartados | Datos del negocio: a qué se dedica, motivo, oferta, cita, preguntas, objeciones y límites |
| `ahora_madrid` | `viernes 23 de octubre de 2026, 11:15` | Interpretar "mañana", "el jueves"… |

Las mismas para las llamadas por teléfono y para **Probar en el navegador** (sección Guion del panel). En el tester web de ElevenLabs hay que dar valores de prueba a todas: `pnpm llamada-prueba` las imprime.

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

## Ajustes recomendados del agente

- **Duración máxima de la llamada: 300 s.** Es un control de coste (plan §19).
- **Retención de datos en ElevenLabs:** ajustarla al mismo plazo que en Configuración → Conservación de datos, o menor. El panel borra las conversaciones de un contacto cuando se ejerce el derecho de supresión.
- **Residencia de datos:** si el plan lo permite, usar la región de la UE.

## Tools de sistema recomendadas

- `end_call` (colgar).
- **Detección de buzón de voz** activada, con la acción de colgar sin dejar mensaje. La app la reconoce por el motivo de fin de llamada.

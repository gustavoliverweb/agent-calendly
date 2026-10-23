# Plan de desarrollo — Agente de voz saliente con agenda en Calendly

> Basado en el brief *"Requisitos: agente de voz saliente con agenda en Calendly"* (20/10/2026, @Gustavo Oliver).
> Este documento es el plan de ejecución: arquitectura, modelo de datos, contratos de API, fases, pruebas, riesgos y checklist de entrega.

---

## Índice

1. [Objetivo y criterios de éxito](#1-objetivo-y-criterios-de-éxito)
2. [Decisiones bloqueantes y prerrequisitos (Fase 0)](#2-decisiones-bloqueantes-y-prerrequisitos-fase-0)
3. [Arquitectura](#3-arquitectura)
4. [Stack y librerías](#4-stack-y-librerías)
5. [Estructura del repositorio](#5-estructura-del-repositorio)
6. [Modelo de datos (Supabase)](#6-modelo-de-datos-supabase)
7. [Máquinas de estado](#7-máquinas-de-estado)
8. [Endpoints y contratos](#8-endpoints-y-contratos)
9. [Motor de lotes (dispatcher)](#9-motor-de-lotes-dispatcher)
10. [Integración con Calendly](#10-integración-con-calendly)
11. [Integración con ElevenLabs](#11-integración-con-elevenlabs)
12. [Panel de control (UI)](#12-panel-de-control-ui)
13. [Seguridad y RGPD](#13-seguridad-y-rgpd)
14. [Observabilidad y logs](#14-observabilidad-y-logs)
15. [Estrategia de pruebas](#15-estrategia-de-pruebas)
16. [Fases de desarrollo y calendario](#16-fases-de-desarrollo-y-calendario)
17. [Plan de aceptación (criterio por criterio)](#17-plan-de-aceptación-criterio-por-criterio)
18. [Riesgos y mitigaciones](#18-riesgos-y-mitigaciones)
19. [Costes operativos](#19-costes-operativos)
20. [Entregables](#20-entregables)
21. [Preguntas abiertas para el negocio](#21-preguntas-abiertas-para-el-negocio)
22. [Fase 2 (fuera de alcance v1)](#22-fase-2-fuera-de-alcance-v1)

---

## 1. Objetivo y criterios de éxito

**Objetivo v1:** un operador no técnico sube contactos por CSV, lanza llamadas (individuales o en lote) y ve qué citas se agendaron, con transcripción y resultado de cada llamada.

**Alcance v1 (incluye):**
- Importación CSV + gestión básica de contactos.
- Llamadas individuales y en lote desde el panel.
- Consulta de disponibilidad y reserva en Calendly *durante* la llamada.
- Registro completo de cada llamada (estado, resultado, transcripción, cita).
- Sincronización de cancelaciones y reprogramaciones desde Calendly.
- Login para pocos usuarios internos (solo invitados).

**Fuera de alcance v1:** llamadas entrantes, multi-tenant / varios calendarios, CRM externo, SMS/WhatsApp.

**Definición de "terminado":** los 8 criterios de aceptación del brief superados en una demo grabada (ver §17), app desplegada en Vercel con dominio, y todos los entregables de §20 completos.

---

## 2. Decisiones bloqueantes y prerrequisitos (Fase 0)

Estas tareas **condicionan el resto** y algunas tienen plazos externos (contratación de línea, verificación de domicilio). Deben arrancar el día 1, en paralelo al desarrollo.

### 2.1 Decisión legal: ¿llamadas comerciales o no comerciales? (BLOQUEANTE)

| Escenario | Tipo de número | Requisitos adicionales |
|---|---|---|
| **Comerciales** (captación, venta, promoción) | Prefijo **400** (obligatorio desde 17/10/2026). Prohibido 6xx/7xx. | Consentimiento previo **obligatorio** por contacto; la app debe **bloquear** llamadas a contactos sin consentimiento. |
| **No comerciales** a personas con relación previa (recordatorios, seguimiento de un servicio contratado) | 6xx viable | Base legal documentada (interés legítimo / ejecución de contrato) en el campo `consentimiento`. |

- Responsable: negocio (+ asesoría legal si hay duda).
- Impacto en código: un flag de configuración `tipo_campana = 'comercial' | 'no_comercial'` que endurece la validación de consentimiento (ver §9.3). Se desarrolla para ambos casos; la decisión solo cambia la configuración y la línea contratada.

### 2.2 Contratación de la línea SIP (operador español)

- Requisitos del trunk para ElevenLabs:
  - SIP trunk con **autenticación digest (usuario/contraseña)** para salida, sin necesidad de registro desde IP fija (o, si el operador exige whitelist de IPs, confirmar que acepta las IPs/rangos SIP publicados por ElevenLabs).
  - Transporte TCP o TLS (verificar los transportes soportados por ElevenLabs en el momento de la integración); SRTP si está disponible.
  - Códecs G.711 (PCMU/PCMA) como mínimo; G.722 deseable.
  - Caller ID = el número contratado (6xx o 400), presentado correctamente (sin CLI oculto).
  - Concurrencia de canales ≥ concurrencia máxima configurada (empezar con 3–5 canales).
- Titular: entidad con **domicilio legal en España** (verificación obligatoria desde 30/10/2026). Preparar CIF, escrituras/justificante de domicilio.
- Candidatos a evaluar (verificar condiciones actuales): operadores VoIP españoles con SIP trunk para empresas (p. ej. netelip, Voztelecom, MásVoz, Ipcom u otros). Pedir: tarifa a móvil español, nº de canales, disponibilidad de numeración 400, soporte de trunks hacia plataformas cloud.
- Entregable de Fase 0: credenciales SIP (host, puerto, transporte, usuario, contraseña) + número.

> **Mitigación de plazos:** mientras llega la línea, todo el desarrollo y las pruebas del agente se hacen con el **tester web de ElevenLabs** (conversación por navegador), que ejecuta las mismas tools contra la app. La línea solo es imprescindible para la Fase 5 (llamada real) y la aceptación.

### 2.3 Cuentas y accesos

| Servicio | Plan | Qué se necesita | Notas |
|---|---|---|---|
| ElevenLabs | Plan con minutos suficientes (Creator/Pro para pruebas; escalar según volumen) | API key, acceso a Agents, Voice Library | Verificar **límite de concurrencia** del plan para fijar `max_concurrencia`. |
| Calendly | **Plan de pago** (Standard o superior: requerido para Scheduling API y webhooks) | Personal Access Token, tipo de evento creado | Event type con duración, horario y ubicación definidos por el negocio. |
| Supabase | Free para empezar (Pro recomendado en producción por backups y sin pausa por inactividad) | Proyecto en región **UE (Frankfurt, eu-central-1)** | Región UE por RGPD y latencia. |
| Vercel | Hobby para dev; **Pro** recomendado (cron por minuto, más duración de funciones) | Proyecto + dominio | Región de funciones `fra1` (cercana a Supabase y España). |
| Dominio | — | DNS apuntando a Vercel | Necesario para URLs estables de webhooks/tools. |

### 2.4 Insumos del negocio

- Nombre comercial ([Negocio]) para el primer mensaje.
- **Guion / system prompt** (lo entrega el negocio; el dev lo integra y adapta a las tools — ver §11.3).
- Elección de voz (escuchar 3–4 candidatas peninsulares de la Voice Library).
- Tipo de cita en Calendly (duración, ubicación: presencial / teléfono / videollamada, preguntas obligatorias).
- Lista de usuarios internos a invitar al panel.
- Política de retención de transcripciones (propuesta: 12 meses; ver §13.4).
- CSV de ejemplo real (anonimizado) para validar el formato.

---

## 3. Arquitectura

```
                         ┌───────────────────────────┐
                         │  Panel de control (Next)  │
                         │  login Supabase Auth      │
                         └─────────────┬─────────────┘
                                       │ (1) Llamar / Lote
                                       ▼
┌──────────────┐  guarda/lee  ┌───────────────────────────────┐  (4) disponibilidad/reserva  ┌──────────────┐
│  Supabase    │◄────────────►│   App + API (Vercel, fra1)    │◄────────────────────────────►│   Calendly   │
│  Postgres    │              │  route handlers, tools,       │◄──── (6) webhook invitee ────│ Scheduling   │
│  Auth, RLS   │              │  webhooks, cron dispatcher    │                              │ API          │
└──────────────┘              └──────┬─────────────▲──────────┘                              └──────────────┘
       ▲                             │ (2) outbound│ (4) tools / (5) post-call webhook
       │ pg_cron (cada min)          ▼             │
       └──── dispara /api/cron ┌───────────────────┴───────┐
                               │  Agente ElevenLabs        │
                               │  STT · LLM · TTS          │
                               └─────────────┬─────────────┘
                                             │ (3) SIP
                                             ▼
                               ┌───────────────────────────┐   voz   ┌──────────────┐
                               │ Operador SIP España       │◄───────►│  Contacto    │
                               │ número 6xx o 400          │         │  (móvil)     │
                               └───────────────────────────┘         └──────────────┘
```

### 3.1 Flujo de una llamada (secuencia detallada)

1. **Operador** pulsa "Llamar" (o lanza un lote) → `POST /api/llamar` (o el dispatcher toma items de la cola).
2. La app valida: contacto existe, no es `no_llamar`, consentimiento OK, dentro de franja horaria, hay hueco de concurrencia.
3. La app inserta `llamadas` con `estado='iniciada'` y obtiene `llamada_id`.
4. La app llama a `POST /v1/convai/sip-trunk/outbound-call` de ElevenLabs con `agent_id`, `agent_phone_number_id`, `to_number` y `conversation_initiation_client_data.dynamic_variables` = `{ nombre, llamada_id, contacto_id, telefono, email, negocio }`.
5. ElevenLabs responde con `conversation_id` (y `sip_call_id`) → la app lo guarda en `llamadas.conversation_id`.
6. (Opcional, mejora de latencia) la app **pre-calienta la caché** de disponibilidad en paralelo (ver §10.4).
7. ElevenLabs marca vía SIP. Si el contacto contesta → saludo con `{{nombre}}` + aviso de IA + aviso de grabación.
8. Durante la conversación el agente llama a `POST /api/tools/disponibilidad` → la app consulta Calendly → devuelve ≤ 3 huecos con texto en español (Europe/Madrid) y `start_time` UTC. La primera llamada a una tool marca la llamada como `en_curso`.
9. El contacto elige → el agente confirma datos (nombre, email) → `POST /api/tools/agendar` → la app crea el invitee en Calendly → guarda `calendly_event_uri`, `fecha_cita`, `cita_agendada=true` y el contacto pasa a `cita_agendada`.
   - Si el hueco ya no está disponible → error legible → el agente vuelve a pedir disponibilidad y ofrece otro, sin colgar.
   - Si Calendly falla → el agente ofrece que le vuelvan a llamar; la app marca `requiere_seguimiento=true`.
10. Si el contacto dice "no me llaméis más" → el agente invoca la tool `no_llamar` (ver §8.5) → efecto **inmediato**.
11. Al colgar, ElevenLabs envía el **webhook post-llamada** → la app verifica firma, guarda transcripción, duración, resumen, resultados de análisis, mapea estados y, si es un lote, libera el slot y despacha la siguiente llamada.
12. Si la llamada no llega a establecerse (no contesta, ocupado, fallo SIP) → ElevenLabs envía `call_initiation_failure` (o se detecta por reconciliación) → `estado='fallida'`/`no_contesta` y se programa reintento.
13. Si el contacto cancela/reprograma en Calendly → `POST /api/webhooks/calendly` → la app actualiza la cita y el estado del contacto.

### 3.2 Principios de diseño

- **La app es la fuente de verdad** (Supabase); ElevenLabs y Calendly son servicios externos con los que se reconcilia.
- **Idempotencia** en todos los webhooks y en `agendar` (reintentos de red no deben duplicar citas ni registros).
- **Nada de secretos en el cliente**: toda llamada a ElevenLabs/Calendly va por servidor.
- **Funciones serverless cortas**: no hay procesos de larga duración; los lotes avanzan por eventos (fin de llamada) + un tick periódico (cron).
- **Fallar en seguro**: ante la duda (sin consentimiento, fuera de franja, estado desconocido), **no llamar**.

---

## 4. Stack y librerías

| Necesidad | Elección | Motivo |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript estricto | Requisito del brief |
| UI | Tailwind CSS + shadcn/ui (Radix) | Componentes accesibles, rápidos de montar |
| Tablas | TanStack Table | Selección múltiple, filtros, paginación |
| Auth/DB cliente | `@supabase/supabase-js` + `@supabase/ssr` | Sesión por cookies en App Router |
| Validación | Zod | Validar bodies de tools, webhooks, CSV, formularios |
| Teléfonos | `libphonenumber-js` | Normalización E.164 con región por defecto `ES` |
| CSV | `papaparse` | Parseo en cliente con preview; detección de delimitador (`;` habitual en Excel español) |
| Fechas/zonas | `date-fns` + `date-fns-tz` (o `Intl` nativo) | Conversión UTC ↔ Europe/Madrid y formato en español |
| Tests | Vitest (unit/integración), MSW (mock HTTP Calendly/ElevenLabs), Playwright (e2e panel) | |
| Lint/format | ESLint + Prettier, `tsc --noEmit` en CI | |
| CI | GitHub Actions: lint, typecheck, tests, migraciones en preview | |
| Migraciones | Supabase CLI (`supabase/migrations/*.sql`) | Entregable explícito del brief |
| Logs | `console` estructurado JSON (Vercel logs) + helper de enmascarado | Opcional: Sentry para errores |

---

## 5. Estructura del repositorio

```
agent-calendly/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/auth/callback/route.ts          # intercambio de código (invitación / magic link)
│   ├── (panel)/layout.tsx                     # layout protegido + navegación
│   ├── (panel)/page.tsx                       # dashboard (KPIs)
│   ├── (panel)/contactos/page.tsx             # lista + filtros + búsqueda + selección
│   ├── (panel)/contactos/importar/page.tsx    # asistente de importación CSV
│   ├── (panel)/contactos/[id]/page.tsx        # ficha de contacto + historial de llamadas
│   ├── (panel)/llamadas/page.tsx              # lista de llamadas
│   ├── (panel)/llamadas/[id]/page.tsx         # detalle: estado, duración, resultado, transcripción, cita
│   ├── (panel)/lotes/page.tsx                 # lotes y su progreso
│   ├── (panel)/lotes/[id]/page.tsx
│   ├── (panel)/configuracion/page.tsx         # concurrencia, franjas, reintentos, festivos, pausa global
│   └── api/
│       ├── llamar/route.ts                    # POST: llamada individual
│       ├── lotes/route.ts                     # POST: crear lote desde selección
│       ├── lotes/[id]/route.ts                # PATCH: pausar/reanudar/cancelar
│       ├── tools/disponibilidad/route.ts      # POST (agente)
│       ├── tools/agendar/route.ts             # POST (agente)
│       ├── tools/no-llamar/route.ts           # POST (agente) — ver §8.5
│       ├── webhooks/elevenlabs/route.ts       # POST (ElevenLabs)
│       ├── webhooks/calendly/route.ts         # POST (Calendly)
│       └── cron/despachar/route.ts            # POST (pg_cron / Vercel Cron) — motor de lotes
├── lib/
│   ├── env.ts                                 # validación Zod de variables de entorno (falla al arrancar)
│   ├── supabase/{server.ts,client.ts,admin.ts,middleware.ts}
│   ├── calendly/{client.ts,availability.ts,booking.ts,webhook.ts,types.ts}
│   ├── elevenlabs/{client.ts,webhook.ts,types.ts,mapping.ts}
│   ├── calls/{launch.ts,dispatcher.ts,window.ts,retries.ts,outcome.ts}
│   ├── contacts/{csv.ts,phone.ts,dedupe.ts}
│   ├── time/{madrid.ts,format-es.ts}
│   ├── security/{bearer.ts,hmac.ts}
│   └── log.ts                                 # logger con enmascarado de PII
├── middleware.ts                              # refresco de sesión + protección de rutas del panel
├── supabase/
│   ├── migrations/0001_init.sql …
│   ├── seed.sql                               # datos de prueba (solo local)
│   └── config.toml
├── scripts/
│   ├── calendly-create-webhook.ts             # registra la suscripción de webhook en Calendly
│   ├── calendly-list-event-types.ts           # ayuda a obtener CALENDLY_EVENT_TYPE_URI
│   ├── replay-webhook.ts                      # reenvía payloads de ejemplo firmados (dev)
│   └── fixtures/{contactos-50.csv, elevenlabs-*.json, calendly-*.json}
├── tests/{unit,integration,e2e}/
├── docs/
│   ├── configuracion-elevenlabs.md            # guía corta (entregable)
│   ├── configuracion-calendly.md              # guía corta (entregable)
│   ├── system-prompt.md                       # guion integrado + versión
│   └── runbook.md                             # operación: pausar, reintentar, borrar datos RGPD
├── .env.example
├── README.md
└── vercel.json                                # región fra1, (cron si se usa Vercel Cron)
```

---

## 6. Modelo de datos (Supabase)

Se respetan las dos tablas del brief (`contactos`, `llamadas`) con sus campos y nombres, y se añaden tablas y campos técnicos permitidos por el brief.

### 6.1 Enums

```sql
create type contacto_estado as enum
  ('pendiente','llamado','cita_agendada','no_interesado','no_contesta','no_llamar');

create type llamada_estado as enum
  ('iniciada','en_curso','completada','fallida','buzon');

create type lote_estado as enum ('activo','pausado','completado','cancelado');

create type lote_item_estado as enum
  ('en_cola','en_llamada','esperando_reintento','completado','omitido','fallido');

create type cita_estado as enum ('activa','cancelada','reprogramada');
```

### 6.2 `contactos`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK default `gen_random_uuid()` | |
| nombre | text not null | `check (length(trim(nombre)) > 0)` |
| telefono | text not null **unique** | E.164, `check (telefono ~ '^\+[1-9][0-9]{7,14}$')` |
| email | text null | validado en app; `citext` opcional |
| estado | contacto_estado not null default `'pendiente'` | |
| consentimiento | boolean not null default false | |
| consentimiento_fecha | timestamptz null | "boolean + fecha" del brief |
| consentimiento_origen | text null | *técnico*: de dónde viene (formulario web, contrato, CSV…) — evidencia RGPD |
| notas | text null | |
| requiere_seguimiento | boolean not null default false | *técnico*: Calendly falló o pidió rellamada |
| seguimiento_motivo | text null | *técnico* |
| intentos | int not null default 0 | *técnico*: intentos sin contestar acumulados |
| ultimo_intento_en | timestamptz null | *técnico* |
| no_llamar_en | timestamptz null | *técnico*: auditoría de la exclusión |
| creado_en | timestamptz not null default now() | |
| actualizado_en | timestamptz not null default now() | trigger |

Índices: `unique(telefono)`, `(estado)`, `(requiere_seguimiento) where requiere_seguimiento`, índice trigram (`pg_trgm`) sobre `nombre`, `email` para búsqueda.

**Regla dura en BD** (defensa en profundidad): un trigger impide pasar un contacto de `no_llamar` a otro estado salvo por una función administrativa explícita (y registrada). Así ningún bug de la app "des-excluye" a nadie.

### 6.3 `llamadas`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| contacto_id | uuid not null FK → contactos(id) **on delete cascade** | cascade para borrado RGPD |
| conversation_id | text **unique** null | ID ElevenLabs; null hasta que responde la API |
| estado | llamada_estado not null default `'iniciada'` | |
| resultado | text null | resumen/clasificación del agente |
| duracion_seg | int null | desde webhook |
| transcripcion | jsonb null | turnos completos `[{role, message, time_in_call_secs, tool_calls?}]` |
| cita_agendada | boolean not null default false | |
| calendly_event_uri | text null | |
| fecha_cita | timestamptz null | UTC |
| creado_en | timestamptz not null default now() | |
| *técnicos:* | | |
| lote_id | uuid null FK → lotes | |
| sip_call_id | text null | |
| clasificacion | text null | `cita_agendada`, `no_interesado`, `rellamar`, `no_llamar`, `sin_respuesta`, `buzon`, `error`, `otro` |
| analisis | jsonb null | `evaluation_criteria_results` + `data_collection_results` crudos |
| motivo_fallo | text null | p. ej. `busy`, `no-answer`, error SIP |
| calendly_invitee_uri | text null | para cruzar webhooks y cancelaciones |
| calendly_cancel_url / calendly_reschedule_url | text null | enlaces útiles en el panel |
| finalizada_en | timestamptz null | |
| webhook_recibido_en | timestamptz null | medir el SLA "< 1 minuto" |
| lanzada_por | uuid null FK → auth.users | auditoría |

Índices: `(contacto_id, creado_en desc)`, `(estado) where estado in ('iniciada','en_curso')` (cálculo rápido de concurrencia), `unique(conversation_id)`, `(lote_id)`.

### 6.4 Tablas adicionales

**`citas`** — historial de citas (permite reprogramaciones sin perder información; `llamadas.calendly_event_uri`/`fecha_cita` se mantienen sincronizados con la cita vigente):

| Campo | Tipo |
|---|---|
| id | uuid PK |
| contacto_id | uuid FK cascade |
| llamada_id | uuid FK null (null si la cita llega de fuera del agente) |
| calendly_event_uri | text |
| calendly_invitee_uri | text **unique** |
| inicio | timestamptz (UTC) |
| estado | cita_estado |
| reprogramada_desde | uuid FK → citas null |
| cancelada_en, motivo_cancelacion | timestamptz, text |
| creado_en | timestamptz |

**`lotes`**: `id, nombre, estado lote_estado, creado_por, creado_en, total, completados` (contadores por vista o trigger).

**`lote_items`** (la cola): `id, lote_id, contacto_id, estado lote_item_estado, intentos int, proximo_intento_en timestamptz, ultima_llamada_id, motivo_omision text, actualizado_en`. `unique(lote_id, contacto_id)`. Índice `(estado, proximo_intento_en)`.

**`configuracion`** (fila única, `id = 1`, `check (id = 1)`):

| Campo | Default |
|---|---|
| max_concurrencia | 2 |
| franjas | `[{"dias":[1,2,3,4,5],"desde":"10:00","hasta":"14:00"},{"dias":[1,2,3,4,5],"desde":"16:00","hasta":"20:00"}]` (hora Madrid) |
| max_reintentos | 2 |
| horas_entre_reintentos | 24 |
| festivos | `[]` (lista de fechas `YYYY-MM-DD` sin llamadas) |
| tipo_campana | `'comercial'` (el más restrictivo por defecto) |
| pausa_global | false (interruptor de emergencia: detiene todo despacho) |
| timeout_llamada_min | 15 (reconciliación de llamadas "colgadas") |

**`eventos_webhook`** (idempotencia y auditoría): `id, origen ('elevenlabs'|'calendly'), id_externo, tipo, recibido_en, procesado_en, error, payload jsonb`. `unique(origen, id_externo)`. El payload se purga con la política de retención.

**`auditoria`** (opcional pero recomendado): `usuario, accion, entidad, entidad_id, detalle, creado_en` — para "no llamar", borrados RGPD, cambios de configuración.

### 6.5 Funciones SQL (RPC)

- `reclamar_items_lote(n int) returns setof lote_items` — toma `n` items elegibles con `FOR UPDATE SKIP LOCKED`, los pasa a `en_llamada`. Evita que dos ejecuciones del dispatcher lancen la misma llamada.
- `llamadas_activas() returns int` — cuenta `llamadas` en `iniciada|en_curso` creadas en los últimos `timeout_llamada_min`.
- `marcar_no_llamar(contacto_id, origen text)` — atómica: estado → `no_llamar`, `no_llamar_en = now()`, items de lote pendientes → `omitido`, registro de auditoría.
- `borrar_contacto_rgpd(contacto_id)` — borra contacto (cascade llamadas/citas/items) y deja traza mínima no personal en auditoría.

### 6.6 Row Level Security

- RLS **activado en todas las tablas**.
- Política: `authenticated` puede `select` en todas las tablas de negocio; `insert/update` en `contactos` (campos permitidos) y `configuracion`. Al ser un único negocio con pocos usuarios internos, no hay separación por fila entre usuarios.
- `anon`: sin acceso a nada.
- Tools, webhooks y cron usan el **cliente service role** (solo servidor, `lib/supabase/admin.ts` con `import 'server-only'`).
- Las operaciones sensibles (lanzar llamada, crear lote, no llamar, borrar RGPD) se hacen por route handlers / server actions que verifican sesión y usan funciones SQL, no escrituras directas desde el navegador.

---

## 7. Máquinas de estado

### 7.1 Llamada (`llamadas.estado`)

```
iniciada ──(primera tool llamada | API status in-progress)──► en_curso
iniciada ──(call_initiation_failure: no-answer/busy/error)──► fallida
iniciada|en_curso ──(post_call: buzón detectado)──────────────► buzon
iniciada|en_curso ──(post_call: conversación normal)─────────► completada
iniciada|en_curso ──(sin webhook tras timeout → reconciliar con GET conversación)──► completada|fallida
```

### 7.2 Contacto (`contactos.estado`) — reglas de mapeo tras cada llamada

Prioridad (la primera que aplica gana):

1. Se invocó `no_llamar` o `data_collection.pide_no_llamar = true` → **`no_llamar`** (permanente).
2. Cita creada en esta llamada → **`cita_agendada`**.
3. `data_collection.interes = 'no'` / motivo de rechazo → **`no_interesado`**.
4. Llamada `fallida` (no-answer/busy) o `buzon` → `intentos++`; si `intentos >= max_reintentos + 1` → **`no_contesta`**; si no, se mantiene y el item del lote pasa a `esperando_reintento`.
   *(Con `max_reintentos = 2` = 1 intento inicial + 2 reintentos. Confirmar con el negocio si "2" significa intentos totales o reintentos — ver §21.)*
5. Contestó pero sin resultado concluyente (p. ej. "ahora no puedo") → **`llamado`** + `requiere_seguimiento = true` si pidió rellamada.

Eventos de Calendly:
- `invitee.canceled` (sin reprogramación) → cita `cancelada`, `llamadas.cita_agendada = false`; contacto → `llamado` + `requiere_seguimiento = true` (motivo "cita cancelada"). *(Confirmar con el negocio si prefieren otro estado.)*
- Reprogramación (`invitee.canceled` con `rescheduled = true` + `invitee.created` nuevo) → cita antigua `reprogramada`, nueva `activa`; `fecha_cita` actualizada; contacto sigue `cita_agendada`.

**Nunca** se sale de `no_llamar` automáticamente.

### 7.3 Item de lote

```
en_cola ──(reclamado por dispatcher)──► en_llamada
en_llamada ──(cita/no interesado/no llamar/contestó)──► completado
en_llamada ──(no contesta/buzón, quedan reintentos)──► esperando_reintento (proximo_intento_en = max(now+24h, siguiente franja))
esperando_reintento ──(proximo_intento_en <= now y en franja)──► en_llamada
en_llamada ──(no contesta, sin reintentos)──► fallido
en_cola|esperando_reintento ──(contacto pasa a no_llamar / sin consentimiento / lote cancelado)──► omitido
```

---

## 8. Endpoints y contratos

Convenciones: todos `runtime = 'nodejs'`, región `fra1`, validación Zod de entrada, respuestas JSON, `x-request-id` en logs.

### 8.1 `POST /api/llamar` (Panel)

- Auth: sesión Supabase (usuario autenticado).
- Body: `{ "contacto_id": "uuid" }`
- Validaciones (en este orden; cada una con error legible para el operador):
  1. `pausa_global = false`.
  2. Contacto existe y `estado != 'no_llamar'`.
  3. Consentimiento válido si `tipo_campana = 'comercial'`.
  4. Dentro de franja horaria y no festivo (para llamada individual también: es requisito legal/comercial; sin "override" en v1).
  5. `llamadas_activas() < max_concurrencia`.
  6. No hay ya una llamada `iniciada|en_curso` para ese contacto (evita doble clic).
- Acción: insertar `llamadas` → llamar a ElevenLabs → actualizar `conversation_id`, `sip_call_id`; `contactos.ultimo_intento_en = now()`.
- Si ElevenLabs falla: `llamadas.estado = 'fallida'`, `motivo_fallo`, respuesta 502 con mensaje.
- Respuesta: `201 { llamada_id, conversation_id }`.

### 8.2 `POST /api/lotes` (Panel)

- Body: `{ "contacto_ids": ["uuid", …], "nombre"?: string }`
- Filtra y reporta: excluye `no_llamar`, sin consentimiento (si comercial), con cita activa, duplicados en otro lote activo.
- Crea `lotes` + `lote_items(en_cola)`; dispara un despacho inmediato (§9).
- Respuesta: `{ lote_id, encolados, omitidos: [{contacto_id, motivo}] }`.
- `PATCH /api/lotes/:id` → `{ accion: 'pausar'|'reanudar'|'cancelar' }`.

### 8.3 `POST /api/tools/disponibilidad` (Agente)

- Auth: `Authorization: Bearer <TOOLS_SECRET>` (comparación en tiempo constante). 401 si falla.
- Body (lo que envía ElevenLabs):
  ```json
  { "desde": "2026-10-22", "hasta": "2026-10-24", "llamada_id": "{{llamada_id}}" }
  ```
  `desde`/`hasta` opcionales (fechas `YYYY-MM-DD` interpretadas en Europe/Madrid). `llamada_id` se inyecta como valor de variable dinámica (no lo rellena el LLM).
- Lógica:
  - Defaults: `desde = ahora + margen mínimo (p. ej. 2 h)`; `hasta = desde + 7 días`.
  - Calendly limita el rango a 7 días por petición → si el rango es mayor, se trocea y se consulta en paralelo (máx. 2 trozos para respetar el SLA).
  - Selección de **máximo 3 huecos** con criterio de variedad: no 3 consecutivos de la misma mañana; preferir días distintos y mezclar mañana/tarde (algoritmo determinista y testeado).
  - Formato del texto: `"jueves 23 a las 11:00"` (día de semana + día del mes + hora 24h en Madrid). Si es hoy/mañana: `"hoy a las 17:30"`, `"mañana jueves 23 a las 11:00"`. Si cambia de mes: `"lunes 2 de noviembre a las 10:00"`.
  - Si la llamada estaba `iniciada` → pasa a `en_curso`.
- Respuesta 200 (siempre 200 con texto útil para el agente, también en error, para que el LLM sepa qué decir):
  ```json
  {
    "huecos": [
      { "texto": "jueves 23 a las 11:00", "start_time": "2026-10-23T09:00:00Z" },
      { "texto": "jueves 23 a las 17:30", "start_time": "2026-10-23T15:30:00Z" },
      { "texto": "viernes 24 a las 10:00", "start_time": "2026-10-24T08:00:00Z" }
    ],
    "mensaje": "Hay estos huecos disponibles: jueves 23 a las 11:00, jueves 23 a las 17:30 o viernes 24 a las 10:00."
  }
  ```
  Sin huecos: `{ "huecos": [], "mensaje": "No hay huecos libres entre esas fechas. Puedes proponer otras fechas." }`
  Error Calendly / timeout: `{ "huecos": [], "error": "calendario_no_disponible", "mensaje": "Ahora mismo no puedo consultar la agenda. Ofrece que le llamemos más tarde." }` + `requiere_seguimiento = true`.
- **SLA < 2 s**: timeout de 1,5 s a Calendly (`AbortController`), caché (§10.4).

### 8.4 `POST /api/tools/agendar` (Agente)

- Auth: Bearer `TOOLS_SECRET`.
- Body:
  ```json
  {
    "start_time": "2026-10-23T09:00:00Z",
    "nombre": "María López",
    "email": "maria@example.com",
    "telefono": "{{telefono}}",
    "llamada_id": "{{llamada_id}}"
  }
  ```
- Validaciones: `start_time` ISO UTC futuro; email válido (Calendly exige email del invitee — ver §10.3); `llamada_id` existente.
- Idempotencia: si esta `llamada_id` ya tiene `cita_agendada = true` con el mismo `start_time` → devolver la confirmación existente sin volver a reservar.
- Acción: `POST https://api.calendly.com/invitees` → guardar `citas`, actualizar `llamadas` (`cita_agendada`, `calendly_event_uri`, `calendly_invitee_uri`, `fecha_cita`) y `contactos` (`estado = 'cita_agendada'`, actualizar email si venía vacío o el contacto lo corrigió).
- Respuestas:
  - Éxito: `{ "ok": true, "mensaje": "Cita confirmada para el jueves 23 a las 11:00. Recibirá un correo de confirmación en maria@example.com." }`
  - Hueco ocupado: `{ "ok": false, "error": "hueco_no_disponible", "mensaje": "Ese hueco ya no está disponible. Consulta la disponibilidad de nuevo y ofrece otro." }`
  - Email inválido: `{ "ok": false, "error": "email_invalido", "mensaje": "El correo no parece válido. Pídele que lo repita despacio." }`
  - Fallo Calendly: `{ "ok": false, "error": "calendario_no_disponible", "mensaje": "No he podido reservar ahora. Ofrece que le volvamos a llamar para cerrar la cita." }` + `requiere_seguimiento = true`, `seguimiento_motivo = 'fallo_calendly'`.

### 8.5 `POST /api/tools/no-llamar` (Agente) — **propuesta adicional al brief**

- El brief exige que "no me llaméis más" marque `no_llamar` de forma **inmediata y permanente**. Depender solo del webhook post-llamada introduce retraso y un punto de fallo (si el webhook no llega, el contacto seguiría en cola). Propuesta: tercera tool mínima.
- Body: `{ "llamada_id": "{{llamada_id}}", "motivo": "texto opcional" }` → `marcar_no_llamar()`.
- Respuesta: `{ "ok": true, "mensaje": "Entendido. No volveremos a llamarle. Despídete amablemente." }`
- **Doble red**: además, el análisis post-llamada extrae `pide_no_llamar`; si es `true`, se aplica igualmente (idempotente).
- *Si el negocio prefiere ceñirse a dos tools, se mantiene solo la vía del webhook post-llamada.*

### 8.6 `POST /api/webhooks/elevenlabs` (ElevenLabs)

- **Verificación de firma**: header `ElevenLabs-Signature: t=<timestamp>,v0=<hmac>`; HMAC-SHA256 con `ELEVENLABS_WEBHOOK_SECRET` sobre `"<t>.<raw_body>"`; comparación en tiempo constante; rechazar si `|now − t| > 30 min` (anti-replay). Leer el **body crudo** (`await req.text()`) antes de parsear. *(Verificar el formato exacto contra la doc vigente o usar el helper del SDK oficial.)*
- Idempotencia: `eventos_webhook(origen='elevenlabs', id_externo=conversation_id + ':' + type)`.
- Tipos a manejar:
  - `post_call_transcription`: `data.conversation_id`, `data.transcript[]`, `data.metadata.call_duration_secs`, `data.analysis.{call_successful, transcript_summary, evaluation_criteria_results, data_collection_results}`, `data.metadata.termination_reason`.
    - Guardar `transcripcion`, `duracion_seg`, `resultado = transcript_summary` (o clasificación), `analisis`, `finalizada_en`, `webhook_recibido_en`.
    - Detección de buzón (por la tool de sistema de voicemail / `termination_reason`) → `estado = 'buzon'`; si no → `completada`.
    - Aplicar reglas de §7.2 al contacto y §7.3 al item del lote.
  - `call_initiation_failure`: `estado = 'fallida'`, `motivo_fallo` (`busy`, `no-answer`, `unknown`…) → reintentos.
  - `post_call_audio`: no se suscribe (no se guarda audio en v1 → menos datos personales).
- Tras procesar: si la llamada pertenecía a un lote → `despachar()` (rellenar el hueco liberado).
- Responder 200 rápido (< 1 s). Si el procesamiento falla, guardar el error en `eventos_webhook` y devolver 500 para que ElevenLabs reintente.
- Correlación: por `conversation_id`. Respaldo: `data.conversation_initiation_client_data.dynamic_variables.llamada_id` (cubre la carrera en la que el webhook llega antes de guardar `conversation_id`).

### 8.7 `POST /api/webhooks/calendly` (Calendly)

- **Verificación**: header `Calendly-Webhook-Signature: t=<ts>,v1=<hmac>`; HMAC-SHA256 con `CALENDLY_WEBHOOK_SIGNING_KEY` sobre `"<t>.<raw_body>"`; tolerancia de 3 min.
- Idempotencia por `payload.uri` (invitee URI) + `event`.
- `invitee.created`:
  - Si existe `citas.calendly_invitee_uri` (creada por el agente) → no-op (ya registrada).
  - Si trae `old_invitee` (reprogramación) → nueva `citas(activa, reprogramada_desde)`, actualizar `llamadas.fecha_cita` / `calendly_event_uri`.
  - Si no hay coincidencia → buscar contacto por email/teléfono; si existe, registrar cita sin `llamada_id`; si no, solo log en `eventos_webhook` (no se crean contactos desde Calendly en v1).
- `invitee.canceled`:
  - `rescheduled = true` → cita `reprogramada` (la nueva llega en `invitee.created`).
  - Si no → cita `cancelada` + reglas §7.2.
- Responder 200 siempre que la firma sea válida y el evento quede registrado.

### 8.8 `POST /api/cron/despachar` (scheduler)

- Auth: `Authorization: Bearer <CRON_SECRET>`.
- Ejecuta `despachar()` (§9) + reconciliación de llamadas colgadas.
- Disparado cada minuto por **Supabase `pg_cron` + `pg_net`** (funciona en cualquier plan de Vercel) o Vercel Cron (requiere Pro para frecuencia por minuto).

---

## 9. Motor de lotes (dispatcher)

### 9.1 Requisitos

- Concurrencia máxima configurable (empezar en 2–3) — no superar el límite del plan ElevenLabs ni entrar en tarifa *burst*.
- Solo dentro de franjas horarias (por defecto L–V 10–14 y 16–20, Europe/Madrid) y fuera de festivos.
- Reintentos para no contesta: por defecto 2, separados ≥ 24 h.
- Nunca incluir `no_llamar`.

### 9.2 Algoritmo `despachar()`

```
1. Leer configuracion. Si pausa_global → salir.
2. Si ahora (Europe/Madrid) no está en franja o es festivo → salir.
3. Reconciliar: llamadas 'iniciada|en_curso' con creado_en < now - timeout_llamada_min
   → GET /v1/convai/conversations/{id} en ElevenLabs → actualizar estado
     (si sigue sin datos → 'fallida', motivo 'timeout').
4. libres = max_concurrencia - llamadas_activas()
   Si libres <= 0 → salir.
5. items = reclamar_items_lote(libres)   -- SKIP LOCKED, filtra:
      lote.estado = 'activo'
      item.estado in ('en_cola','esperando_reintento')
      item.proximo_intento_en is null or <= now()
      contacto.estado not in ('no_llamar','cita_agendada')
      consentimiento OK si tipo_campana = 'comercial'
      sin llamada activa para ese contacto
   orden: proximo_intento_en asc nulls first, creado_en asc
6. Para cada item (en paralelo, Promise.allSettled): launchCall(contacto, lote_id)
   - éxito → item.ultima_llamada_id
   - error → item.estado = 'esperando_reintento' (o 'fallido' si error permanente, p. ej. número inválido)
```

- **Disparadores**: (a) cron cada minuto; (b) al crear/reanudar un lote; (c) al recibir el webhook de fin de llamada de un item de lote. Con (c) la cola avanza en segundos sin depender del tick.
- **Carrera de concurrencia**: dos ejecuciones simultáneas podrían leer el mismo `libres`. Se evita con un **advisory lock** de Postgres (`pg_try_advisory_xact_lock`) dentro de una RPC `despachar_reservar(n)` que cuenta activas y reclama items en la misma transacción.

### 9.3 Franja horaria y reintentos

- `lib/calls/window.ts`: `estaEnFranja(fecha, config)` y `siguienteInicioFranja(fecha, config)`, todo en Europe/Madrid (cuidado con cambios de horario: último domingo de octubre/marzo — test específico).
- Al programar un reintento: `proximo_intento_en = siguienteInicioFranja(max(now + horas_entre_reintentos, …))`; idealmente alternar mañana/tarde respecto al intento anterior para mejorar la contactabilidad (mejora opcional).
- Para no lanzar todo el lote justo al abrir la franja, el despacho ya está limitado por la concurrencia: no hay "ráfaga".

### 9.4 Consideraciones legales en el dispatcher

- Si `tipo_campana = 'comercial'` → items sin `consentimiento = true` se marcan `omitido (sin_consentimiento)`.
- La comprobación de `no_llamar` se hace **en el momento de lanzar** (no solo al crear el lote): si alguien marca "no llamar" con el lote en curso, el contacto se omite.

---

## 10. Integración con Calendly

### 10.1 Configuración

- Auth: `Authorization: Bearer <CALENDLY_TOKEN>` (Personal Access Token del usuario dueño del calendario).
- `CALENDLY_EVENT_TYPE_URI`: obtener con `GET /users/me` → `GET /event_types?user=<uri>` (script `scripts/calendly-list-event-types.ts`).
- Webhook: `POST /webhook_subscriptions` con `url = https://<dominio>/api/webhooks/calendly`, `events = ["invitee.created","invitee.canceled"]`, `scope = "user"` (o `organization`), `signing_key = CALENDLY_WEBHOOK_SIGNING_KEY` (script `scripts/calendly-create-webhook.ts`).

### 10.2 Disponibilidad

- `GET /event_type_available_times?event_type=<uri>&start_time=<iso>&end_time=<iso>`
  - Rango máximo 7 días; `start_time` debe ser futuro.
  - Devuelve `collection[]` con `start_time` (UTC) y `status = "available"`.
- Respeta el horario configurado en Calendly (horario laboral del negocio), buffers y avisos mínimos definidos allí → **la lógica de horarios de citas vive en Calendly**, la app no la duplica.

### 10.3 Reserva

- `POST /invitees` (Scheduling API, plan de pago). Body típico (verificar campos exactos en la doc vigente durante la Fase 3):
  ```json
  {
    "event_type": "<CALENDLY_EVENT_TYPE_URI>",
    "start_time": "2026-10-23T09:00:00Z",
    "invitee": { "name": "María López", "email": "maria@example.com", "timezone": "Europe/Madrid",
                 "text_reminder_number": "+34600000000" },
    "location": { "kind": "<según el tipo de evento>" },
    "questions_and_answers": [ … si el tipo de evento tiene preguntas obligatorias … ]
  }
  ```
- Puntos críticos:
  - **El email es obligatorio** para el invitee en Calendly, pero en `contactos` es opcional. Estrategia: (1) si el contacto tiene email, el agente lo **confirma** ("¿le envío la confirmación a maria@…?"); (2) si no, el agente lo **pide y lo deletrea de vuelta**. El prompt debe incluir técnicas para dictado de emails (arroba, punto, guion). Validación de formato en la tool y error legible si falla. *(Alternativa a decidir con el negocio: email genérico del negocio como invitee cuando el contacto no quiera dar email — ver §21.)*
  - **Ubicación**: si el tipo de evento tiene varias ubicaciones o requiere teléfono, enviar la correcta; recomendación: tipo de evento con una sola ubicación fija para simplificar.
  - **Preguntas obligatorias** del tipo de evento: evitarlas o rellenarlas con datos conocidos.
  - Mapeo de errores: 400/409/422 con mensaje de hueco no disponible → `hueco_no_disponible`; 401/403 → alerta (token caducado) + `calendario_no_disponible`; 5xx/timeout → `calendario_no_disponible`; 429 → backoff corto una vez si el SLA lo permite.

### 10.4 Rendimiento (SLA < 2 s)

- Caché en memoria del proceso + tabla/Upstash opcional con TTL **60 s** para la respuesta de disponibilidad por rango.
- **Pre-calentado** al lanzar la llamada (paso 6 de §3.1): cuando el agente pregunte por huecos, normalmente ya hay respuesta cacheada (los ~10–20 s del saludo dan margen).
- `agendar` **nunca** usa caché (Calendly valida el hueco en el momento de la reserva; si está ocupado devuelve error → flujo "ofrecer otro").
- Tras reservar o recibir un webhook de Calendly → invalidar caché.
- Región Vercel `fra1`; Supabase en Frankfurt; las tools hacen una sola consulta a Supabase (o ninguna en el camino crítico de disponibilidad; la marca `en_curso` se hace sin `await` bloqueante con `waitUntil`/`after()`).
- En ElevenLabs: activar en las tools el mensaje previo ("Un momento, que lo miro en la agenda…") para que la espera sea natural.
- Medición: log de latencia por tool (p50/p95) y test de carga ligera (§15.4).

---

## 11. Integración con ElevenLabs

### 11.1 Llamada saliente

- `POST https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call` con header `xi-api-key: <ELEVENLABS_API_KEY>`:
  ```json
  {
    "agent_id": "<ELEVENLABS_AGENT_ID>",
    "agent_phone_number_id": "<ELEVENLABS_PHONE_NUMBER_ID>",
    "to_number": "+34600000000",
    "conversation_initiation_client_data": {
      "dynamic_variables": {
        "nombre": "María",
        "llamada_id": "uuid",
        "contacto_id": "uuid",
        "telefono": "+34600000000",
        "email": "maria@example.com",
        "tiene_email": true
      }
    }
  }
  ```
- Respuesta esperada: `{ success, message, conversation_id, sip_call_id }`.
- Timeout de 10 s; un único reintento solo si el error es de red antes de obtener respuesta (riesgo de doble llamada → preferir no reintentar y marcar fallida).

### 11.2 Configuración del agente (checklist para `docs/configuracion-elevenlabs.md`)

| Ajuste | Valor |
|---|---|
| Idioma | Español (`es`) |
| Voz | Acento peninsular; elegida tras escuchar 3–4 candidatas de la Voice Library; ajustar estabilidad/velocidad |
| Modelo TTS | El de menor latencia compatible con español (Flash/Turbo) |
| LLM | Rápido (Gemini Flash o Claude Haiku); plan B: uno más potente si falla en objeciones. Temperatura baja (0.2–0.4) |
| Primer mensaje | `Hola, ¿hablo con {{nombre}}? Le llamo de parte de [Negocio]. Soy un asistente virtual, una inteligencia artificial, y esta llamada se graba y transcribe para gestionar su cita.` (redacción final con el negocio; debe cubrir AI Act art. 50 + aviso de grabación RGPD) |
| Variables dinámicas | `nombre`, `llamada_id`, `contacto_id`, `telefono`, `email`, `tiene_email` (con valores de prueba para el tester web) |
| Tools (server/webhook) | `disponibilidad`, `agendar`, (`no_llamar`) → URLs de la app, método POST, header `Authorization: Bearer <TOOLS_SECRET>` (guardado como secreto en ElevenLabs), timeout de respuesta corto (~5 s), parámetros con descripciones claras; `llamada_id`/`telefono` como valores desde variable dinámica |
| Tools de sistema | `end_call` (colgar), **detección de buzón de voz** activada, acción: colgar sin dejar mensaje |
| Número | Importado como SIP trunk: Address = host del operador; credenciales usuario/contraseña SIP; transporte y cifrado según operador → copiar `phone_number_id` a `ELEVENLABS_PHONE_NUMBER_ID` |
| Webhook post-llamada | `https://<dominio>/api/webhooks/elevenlabs`, con secreto HMAC → `ELEVENLABS_WEBHOOK_SECRET`; eventos de transcripción y de fallo de inicio de llamada |
| Criterio de evaluación | `cita_agendada`: "¿Se reservó con éxito una cita mediante la tool agendar?" |
| Data collection | `interes` (sí/no/dudoso), `motivo_rechazo` (string), `pide_rellamada` (bool), `momento_rellamada` (string), `pide_no_llamar` (bool), `email_confirmado` (string) |
| Duración máx. llamada | 5 min (control de costes) |
| Silencio / turnos | Timeout de silencio ~10–15 s con un recordatorio y luego colgar |
| Retención/privacidad | Revisar ajustes de retención de datos en ElevenLabs (minimizar lo almacenado allí; la app es el registro) |

### 11.3 System prompt (guion)

Lo entrega el negocio. El dev lo **integra y adapta** a las tools. Estructura que debe cubrir (`docs/system-prompt.md`, versionado):

1. **Identidad y tono**: asistente virtual de [Negocio], castellano peninsular, trato de usted (o tú, según negocio), frases cortas, sin tecnicismos, nunca negar ser una IA.
2. **Objetivo**: agendar una cita de [tipo de cita].
3. **Motivo de la llamada** (texto del negocio).
4. **Flujo**:
   - Confirmar identidad. Si no es la persona → preguntar cuándo localizarla, no dar detalles, despedirse.
   - Explicar el motivo brevemente.
   - Si hay interés → llamar a `disponibilidad` (con `desde`/`hasta` si el contacto da preferencia: "la semana que viene", "por la tarde" → convertir a fechas).
   - Ofrecer **2–3 huecos** leyendo el campo `texto` tal cual. Nunca inventar horarios.
   - Al elegir: confirmar nombre y email (deletrear de vuelta) → `agendar` con el `start_time` exacto del hueco elegido.
   - Leer la confirmación devuelta por la tool.
   - Si `hueco_no_disponible` → disculparse, volver a llamar a `disponibilidad`, ofrecer otros.
   - Si `calendario_no_disponible` → ofrecer que le vuelvan a llamar, preguntar mejor momento, despedirse.
5. **Objeciones**:
   - "Ahora no puedo" → preguntar mejor momento, registrar (data collection), despedirse.
   - "No me interesa" → una sola reformulación breve si procede; si insiste, agradecer y despedirse.
   - "No me llaméis más" → **sin insistir**: confirmar, llamar a `no_llamar`, despedirse.
   - "¿Eres un robot?" → confirmar con naturalidad que es un asistente virtual.
   - "¿De dónde tenéis mi número?" → respuesta preparada por el negocio (origen del dato / consentimiento).
   - Petición de hablar con un humano → explicar que un compañero le llamará; marcar rellamada.
6. **Reglas**: no dar precios/información no incluida en el guion; no prometer nada fuera del guion; no pedir datos sensibles; ofrecer siempre el cierre con `end_call`.
7. **Fechas**: la fecha/hora actual en Madrid se le pasa como variable dinámica (`{{ahora_madrid}}`, p. ej. "martes 20 de octubre de 2026, 11:15") para que interprete "mañana" o "el jueves" correctamente.

Pruebas del prompt: batería de ≥ 15 escenarios (§15.3) antes de hacer llamadas reales.

---

## 12. Panel de control (UI)

Todo en español, responsive (uso principal en escritorio).

### 12.1 Login
- Supabase Auth, **registro público deshabilitado**; usuarios creados por invitación (dashboard de Supabase o pantalla de admin mínima con `auth.admin.inviteUserByEmail`).
- Método: email + contraseña (con recuperación) o magic link. Recomendado: email + contraseña.
- `middleware.ts` protege todo `(panel)`; sesión por cookies con `@supabase/ssr`.

### 12.2 Dashboard
- KPIs del día / semana: llamadas realizadas, contestadas, citas agendadas, tasa de conversión, minutos consumidos y coste estimado (minutos × tarifa configurable).
- Llamadas en curso (en vivo con Supabase Realtime o polling 5 s).
- Contactos con `requiere_seguimiento`.
- Aviso si hay errores recientes de integración (token Calendly caducado, fallos SIP repetidos).

### 12.3 Contactos
- Tabla paginada en servidor: nombre, teléfono (formateado), email, estado (badge), consentimiento, intentos, último intento, seguimiento.
- **Filtro por estado** (multi-select), filtro "requiere seguimiento", **búsqueda** por nombre/teléfono/email.
- Selección múltiple → "Llamar a seleccionados" (crea lote, muestra resumen de omitidos y por qué).
- Acciones por fila: **Llamar**, **Marcar no llamar** (con confirmación), editar notas/email, borrar (RGPD, con doble confirmación).
- Ficha de contacto: datos, historial de llamadas y citas, auditoría de consentimiento.

### 12.4 Importación CSV (asistente en 3 pasos)
1. **Subir** archivo (detección de delimitador `,`/`;`, codificación UTF-8 y Windows-1252 — habitual al exportar de Excel en España).
2. **Mapear columnas** (autodetección de cabeceras: nombre/teléfono/telefono/móvil, email/correo, consentimiento, fecha_consentimiento).
3. **Previsualizar y validar** fila a fila:
   - `valido`
   - `telefono_invalido` (no parseable / no es número válido; región por defecto ES: `600 11 22 33`, `0034…`, `+34…` se normalizan a `+34600112233`)
   - `duplicado_en_archivo` (mismo teléfono normalizado repetido en el CSV; se conserva la primera aparición)
   - `duplicado_en_bd` (ya existe; opción: ignorar o actualizar campos vacíos)
   - `falta_nombre`
   - `email_invalido` (aviso, no bloquea: el email es opcional)
   - `sin_consentimiento` (aviso; bloquea la llamada si la campaña es comercial)
   - Valores de consentimiento aceptados: `sí/si/s/true/1/yes/x` → true; resto false.
4. **Confirmar** → inserción en servidor (re-validación en servidor, nunca confiar en el cliente) en bloques, con `on conflict (telefono) do nothing` y resumen final: importados / duplicados / inválidos + descarga CSV de errores.
- Límite razonable: 5.000 filas por archivo en v1.

### 12.5 Llamadas
- Lista con filtros (estado, resultado, fecha, lote, con cita).
- **Detalle**: contacto, estado, duración (mm:ss), resultado/resumen, clasificación, datos extraídos, **transcripción** en formato chat (agente/usuario, con marcas de tiempo y llamadas a tools resaltadas), **enlace a la cita** (fecha en hora de Madrid + enlace de reprogramar/cancelar o enlace a la vista del evento en Calendly), estado de la cita (activa/cancelada/reprogramada).
- Actualización en vivo del estado mientras la llamada está en curso.

### 12.6 Lotes
- Lista de lotes con progreso (en cola / en llamada / esperando reintento / completados / omitidos), citas conseguidas.
- Acciones: pausar, reanudar, cancelar.
- Indicador "fuera de franja — se reanudará el lunes a las 10:00".

### 12.7 Configuración
- Concurrencia máxima (1–10, con aviso sobre el límite del plan de ElevenLabs y la tarifa burst).
- Franjas horarias por día de la semana (editor simple).
- Festivos.
- Máximo de reintentos y horas entre reintentos.
- Tipo de campaña (comercial / no comercial) — solo visible/editable por admin.
- **Pausa global** (botón rojo visible también en el layout).

---

## 13. Seguridad y RGPD

### 13.1 Secretos y entorno
- Todas las variables en Vercel (Production / Preview / Development separadas) y documentadas en `.env.example`.
- `lib/env.ts` valida con Zod al arrancar; la app falla en build/arranque si falta alguna.
- Secretos solo en servidor (`import 'server-only'` en módulos que los usen). En el cliente solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la anon key es pública por diseño y está protegida por RLS).
- Variables adicionales al brief: `CRON_SECRET`, `APP_URL`, `NEGOCIO_NOMBRE` (opcional), `COSTE_MINUTO_ESTIMADO` (opcional).

### 13.2 Protección de endpoints
- Tools: Bearer `TOOLS_SECRET` (≥ 32 bytes aleatorios), comparación en tiempo constante; 401 sin detalles.
- Webhooks: firma HMAC + ventana de tiempo + idempotencia; 401 si la firma no es válida.
- Cron: Bearer `CRON_SECRET`.
- Panel: sesión obligatoria; las server actions/route handlers verifican `auth.getUser()` en servidor.
- Validación Zod de todas las entradas; límites de tamaño de body; rate limit básico en tools (por si el secreto se filtra).
- Cabeceras de seguridad (CSP básica, `X-Frame-Options`, etc.) en `next.config`.
- Rotación: procedimiento documentado en el runbook para rotar `TOOLS_SECRET` (cambiar en Vercel y en ElevenLabs a la vez).

### 13.3 RGPD
- **Base legal por contacto**: `consentimiento` + `consentimiento_fecha` + `consentimiento_origen`.
- **Aviso** de IA y de grabación/transcripción en el primer mensaje.
- **Minimización**: no se guarda audio; no se loguean datos personales completos.
- **Derecho de supresión**: acción "Borrar contacto (RGPD)" que elimina contacto, llamadas, transcripciones y citas locales (cascade) y deja auditoría sin PII. Procedimiento manual documentado para borrar también en ElevenLabs (API `DELETE` de conversación) y en Calendly si aplica — automatizable en la acción.
- **Lista de exclusión**: `no_llamar` inmediato, permanente, protegido por trigger en BD.
- **Encargados del tratamiento**: ElevenLabs, Calendly, Supabase, Vercel y operador → el negocio debe firmar/aceptar sus DPA; preferir regiones UE donde sea posible (Supabase Frankfurt, Vercel fra1; revisar residencia de datos en ElevenLabs).
- **Retención**: transcripciones y payloads de webhooks purgados tras N meses (job programado en pg_cron).
- Recomendación al negocio: consultar la Lista Robinson si la campaña es comercial a no clientes.

### 13.4 Logs sin PII
- `lib/log.ts`: `maskPhone('+34600112233') → '+34******233'`, `maskEmail('maria@example.com') → 'm***@example.com'`; nunca loguear transcripciones ni bodies completos de webhooks/tools.

---

## 14. Observabilidad y logs

- Logs JSON estructurados con `request_id`, `llamada_id`, `conversation_id`, endpoint, latencia, resultado.
- Métricas mínimas (vía logs/consultas): latencia p95 de tools, tasa de error Calendly, tiempo webhook post-llamada (fin de llamada → `webhook_recibido_en`), llamadas fallidas por motivo.
- Tabla `eventos_webhook` como registro consultable de lo recibido y errores de procesamiento.
- Alertas simples (opcional v1): Sentry para excepciones; aviso en el dashboard si hay > N fallos de integración en la última hora.

---

## 15. Estrategia de pruebas

### 15.1 Unitarias (Vitest)
- `phone.ts`: normalización E.164 (formatos españoles, con espacios, guiones, `0034`, `+34`, fijos 9xx, móviles 6xx/7xx, inválidos, extranjeros).
- `csv.ts` + `dedupe.ts`: duplicados en archivo y contra BD, delimitadores, codificación, cabeceras alternativas.
- `format-es.ts`: "jueves 23 a las 11:00", hoy/mañana, cambio de mes, **cambio de horario** (25/10/2026 y marzo).
- Selección de 3 huecos variados.
- `window.ts`: dentro/fuera de franja, bordes (13:59, 14:00, 16:00), fines de semana, festivos, siguiente inicio de franja.
- `retries.ts`: cálculo de `proximo_intento_en`, agotamiento de reintentos.
- `outcome.ts`: mapeo payload post-llamada → estados (todas las prioridades de §7.2).
- `hmac.ts`: firmas válidas, inválidas, caducadas, body alterado (ElevenLabs y Calendly).

### 15.2 Integración (Vitest + MSW + Supabase local)
- Supabase local (`supabase start`) con migraciones aplicadas; tests de RLS (anon no lee nada; authenticated sí).
- Tools: 401 sin token; disponibilidad con Calendly mockeado (OK, vacío, timeout, 5xx); agendar (OK, hueco ocupado, email inválido, idempotencia por doble envío).
- Webhooks: fixtures reales capturados en desarrollo; firma; idempotencia (mismo evento dos veces); orden invertido (webhook antes de guardar `conversation_id`).
- Dispatcher: concurrencia respetada con ejecuciones simultáneas, omisión de `no_llamar` añadido a mitad de lote, franja, reintentos.

### 15.3 Pruebas del agente (conversacionales)
- Tester web de ElevenLabs con variables dinámicas de prueba, apuntando a un entorno de **preview** con Calendly real (tipo de evento de pruebas).
- Batería de escenarios (checklist en `docs/`):
  1. Acepta el primer hueco.
  2. Pide otro día ("la semana que viene por la tarde").
  3. Ningún hueco le encaja.
  4. Hueco ocupado durante la llamada (ocuparlo manualmente en Calendly antes de confirmar).
  5. Calendly caído (forzar error en preview con flag de entorno).
  6. Email ya conocido → confirmar.
  7. Email nuevo dictado con caracteres difíciles (guiones, números, dominios poco comunes).
  8. "Ahora no puedo, llámame el jueves".
  9. "No me interesa".
  10. "No me llaméis más".
  11. "¿Eres un robot?".
  12. "¿De dónde tenéis mi número?".
  13. Contesta otra persona.
  14. Interrupciones frecuentes / ruido.
  15. Silencio prolongado.
  16. Quiere hablar con un humano.
- Revisar latencias percibidas y naturalidad de la voz; iterar prompt y elegir LLM.

### 15.4 End-to-end
- Playwright: login, importar CSV de 50 filas, filtrar, buscar, lanzar llamada (ElevenLabs mockeado en preview mediante flag `MOCK_ELEVENLABS=true`), ver detalle con transcripción (webhook reenviado con `scripts/replay-webhook.ts`).
- Llamadas reales a móviles propios del equipo (≥ 3 números de operadores distintos: Movistar, Vodafone, Orange/MásOrange) para validar caller ID, calidad de audio y detección de buzón.
- Prueba de latencia: 20 invocaciones de `disponibilidad` y `agendar` contra preview → p95 < 2 s.

---

## 16. Fases de desarrollo y calendario

Estimación para **1 desarrollador** a tiempo completo. Fase 0 corre en paralelo y su duración depende de terceros (sobre todo la línea SIP).

| Fase | Contenido | Duración | Depende de |
|---|---|---|---|
| **0. Prerrequisitos** | Decisión comercial/no comercial; contratar línea SIP; cuentas (ElevenLabs, Calendly de pago, Supabase, Vercel, dominio); insumos del negocio | En paralelo (1–3 semanas por la línea) | Negocio |
| **1. Cimientos** | Repo Next.js + TS + Tailwind + shadcn; CI; Supabase (local + proyecto UE); migración inicial (enums, tablas, RLS, triggers, RPC); `env.ts`; auth (login, middleware, invitaciones); layout del panel; deploy en Vercel con dominio | 2–3 días | Cuentas |
| **2. Contactos** | Lista con filtros/búsqueda/paginación; ficha; importación CSV con validación E.164 y duplicados; "no llamar"; borrado RGPD; tests | 3 días | F1 |
| **3. Calendly** | Cliente Calendly; `disponibilidad` (formateo, selección de huecos, caché, timeout); `agendar` (idempotencia, errores); webhook Calendly + script de suscripción; tests con MSW | 3 días | F1, plan Calendly |
| **4. Agente ElevenLabs (sin teléfono)** | Crear agente; voz; LLM; primer mensaje; tools apuntando a preview; data collection y evaluación; integrar guion; batería de escenarios en tester web; webhook post-llamada (firma, mapeo, idempotencia) | 3–4 días | F3, guion del negocio |
| **5. Llamadas reales** | Importar SIP trunk en ElevenLabs; `POST /api/llamar`; pre-calentado de caché; detección de buzón; `call_initiation_failure`; reconciliación; detalle de llamada con transcripción en vivo; pruebas a móviles propios | 2–3 días | F4 + **línea SIP** |
| **6. Lotes** | Tablas de lotes; RPC con SKIP LOCKED + advisory lock; dispatcher; pg_cron; franjas, festivos, reintentos; UI de lotes y configuración; pausa global; tests de concurrencia | 3 días | F5 |
| **7. Endurecimiento** | Revisión de seguridad (RLS, secretos, firmas, rate limit), logs con enmascarado, retención, dashboard KPIs, manejo de errores y estados vacíos en UI, accesibilidad básica | 2 días | F6 |
| **8. Aceptación y entrega** | Ejecutar §17 en producción; grabar demo; README, `.env.example`, guías ElevenLabs/Calendly, runbook; traspaso | 2 días | F7 |

**Total desarrollo: ~20–23 días laborables (~4–5 semanas)**, condicionado a tener la línea SIP antes del inicio de la Fase 5. Si la línea se retrasa, las fases 6–7 se adelantan (el dispatcher se puede probar con ElevenLabs mockeado) y la Fase 5 se completa al llegar la línea.

### Hitos de revisión con el negocio
- **H1 (fin F2):** panel con login e importación CSV funcionando en la URL de producción.
- **H2 (fin F4):** demo del agente en navegador reservando citas reales en Calendly → validar voz, guion, tono.
- **H3 (fin F5):** primera llamada real a móvil propio.
- **H4 (fin F8):** demo grabada con todos los criterios de aceptación.

---

## 17. Plan de aceptación (criterio por criterio)

| # | Criterio del brief | Procedimiento de verificación | Evidencia |
|---|---|---|---|
| 1 | Importar CSV de 50 contactos con duplicados y teléfonos inválidos los marca correctamente | `scripts/fixtures/contactos-50.csv` con 40 válidos, 4 duplicados en archivo, 2 duplicados con BD, 3 teléfonos inválidos, 1 sin nombre (conteos conocidos). Importar y comprobar preview y resumen. | Captura del resumen + test automatizado |
| 2 | Llamada de prueba a móvil propio saluda por el nombre y se presenta como asistente virtual | Contacto "Gustavo" con móvil propio → "Llamar". | Grabación de pantalla + audio / transcripción en panel |
| 3 | El agente ofrece huecos reales en hora de Madrid y la cita aparece en el calendario | Comparar huecos dichos con la página de reservas de Calendly; aceptar uno; comprobar evento en Calendly y en el panel con la misma hora. | Captura Calendly + panel |
| 4 | Si el hueco se ocupa durante la llamada, el agente ofrece otro sin colgar | Durante la llamada, cuando ofrezca huecos, reservar ese hueco desde otro navegador en Calendly; elegirlo en la llamada. | Transcripción con error `hueco_no_disponible` y nueva oferta |
| 5 | Tras colgar, transcripción y resultado en el panel en < 1 min | Medir `webhook_recibido_en − finalizada_en` y observar el panel actualizándose solo. | Grabación con reloj visible |
| 6 | Cancelar la cita en Calendly actualiza el estado en el panel | Cancelar desde el email/enlace de Calendly. Repetir con reprogramación. | Panel: cita cancelada / nueva fecha |
| 7 | "No me llaméis más" marca `no_llamar` y no entra en lotes | Decirlo en llamada; comprobar estado inmediato; crear lote que lo incluya → aparece como omitido. | Captura ficha + resumen del lote |
| 8 | Lote de 10 respeta concurrencia, franja y reintentos | Concurrencia 2; 10 contactos (varios móviles del equipo, algunos sin contestar a propósito). Observar que nunca hay > 2 activas; probar franja ajustando config para que cierre durante el lote (se detiene y reanuda); reintentos: con config de prueba `horas_entre_reintentos` reducido en preview + test automatizado con 24 h. | Captura de lote + logs + test |

---

## 18. Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Retraso en contratar la línea SIP (verificación de domicilio desde 30/10/2026, numeración 400) | Alta | Alto | Iniciar en Fase 0 día 1; desarrollar con tester web; tener 2 operadores candidatos |
| Incompatibilidad técnica SIP trunk ↔ ElevenLabs (transporte, auth, IPs, códecs) | Media | Alto | Preguntar al operador antes de contratar por la compatibilidad con plataformas cloud; prueba de concepto de 1 llamada antes de comprometer volumen |
| Llamadas bloqueadas/etiquetadas como spam por operadores móviles | Media | Alto | Número español correcto (400 si comercial), volumen gradual, caller ID consistente, baja concurrencia inicial |
| Latencia de tools > 2 s | Media | Medio | Caché + pre-calentado, región fra1, timeout 1,5 s, mensaje "un momento" en la tool |
| Captura de email por voz poco fiable | Alta | Medio | Confirmar email existente en vez de pedirlo; deletreo de vuelta; validación; alternativa acordada con negocio (§21) |
| LLM rápido falla en objeciones o se inventa horarios | Media | Medio | Prompt con reglas explícitas ("nunca inventes horarios"), batería de escenarios, probar LLM más potente |
| Webhook post-llamada no llega o llega tarde | Baja | Medio | Reconciliación por API en el cron; idempotencia; respaldo por `llamada_id` en variables dinámicas |
| Doble reserva por reintento de la tool | Baja | Medio | Idempotencia por `llamada_id` + `start_time` |
| Superar concurrencia del plan / tarifa burst | Media | Medio | Concurrencia configurable con advisory lock; valor inicial 2 |
| Incumplimiento legal (consentimiento, horarios, exclusión) | Baja | Muy alto | Validaciones en app **y** BD; tipo de campaña configurable; franjas; trigger de `no_llamar`; auditoría |
| Token de Calendly revocado/caducado | Baja | Alto | Detección de 401 → alerta en dashboard + la tool degrada a "le llamaremos" |
| Cambios en APIs de terceros (endpoints/payloads) | Media | Medio | Encapsular en `lib/calendly` y `lib/elevenlabs`; validar payloads con Zod de forma tolerante (campos desconocidos permitidos); fixtures reales en tests |
| Cambio de horario (DST) rompe franjas/formatos | Baja | Medio | Toda la lógica con zona IANA `Europe/Madrid`; tests en fechas de cambio |

---

## 19. Costes operativos

Estimación del brief: **~$0,30–0,40 por llamada de 3 minutos**.

| Concepto | Coste |
|---|---|
| ElevenLabs Agents | $0,08/min (burst $0,16/min) |
| Planes ElevenLabs | $6 (75 min) · $22 (275) · $99 (1.238) · $299 (3.738) · $990 (12.375) |
| LLM | ~$0,001–0,01/min |
| Telefonía a móvil español | ~1–4 céntimos/min (confirmar con operador) |
| Calendly | Plan de pago (necesario para Scheduling API) |
| Vercel + Supabase | Gratis en volumen bajo (recomendado Pro en producción: ~$20 + ~$25/mes) |

Controles de coste en la app: duración máxima de llamada (5 min), cuelgue en buzón sin mensaje, concurrencia baja para evitar burst, KPI de minutos/coste estimado en el dashboard.

---

## 20. Entregables

- [ ] Repositorio con la app, `README.md` de instalación (local + producción) y `.env.example` comentado.
- [ ] Esquema SQL / migraciones de Supabase (`supabase/migrations/`) + `seed.sql`.
- [ ] App desplegada en Vercel con dominio.
- [ ] Guía corta para configurar tools y webhooks en ElevenLabs (`docs/configuracion-elevenlabs.md`) y Calendly (`docs/configuracion-calendly.md`), con capturas.
- [ ] Scripts de ayuda (listar event types, crear webhook Calendly, reenviar webhooks de prueba).
- [ ] `docs/system-prompt.md` con el guion integrado y versionado.
- [ ] `docs/runbook.md`: pausar todo, rotar secretos, reintentar, borrar datos RGPD, qué hacer si Calendly/SIP falla.
- [ ] Suite de tests (unit/integración/e2e) en CI verde.
- [ ] Criterios de aceptación superados en una **demo grabada**.

### `.env.example` (propuesto)

```bash
# --- ElevenLabs ---
ELEVENLABS_API_KEY=            # Lanzar llamadas
ELEVENLABS_AGENT_ID=           # Agente a usar
ELEVENLABS_PHONE_NUMBER_ID=    # Número SIP importado
ELEVENLABS_WEBHOOK_SECRET=     # Verificar firma del webhook post-llamada

# --- Tools del agente ---
TOOLS_SECRET=                  # Bearer que protege /api/tools/* (openssl rand -hex 32)

# --- Calendly ---
CALENDLY_TOKEN=                # Personal Access Token
CALENDLY_EVENT_TYPE_URI=       # https://api.calendly.com/event_types/XXXX
CALENDLY_WEBHOOK_SIGNING_KEY=  # Verificar webhooks de Calendly

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=      # = SUPABASE_URL (expuesta al cliente, pública por diseño)
NEXT_PUBLIC_SUPABASE_ANON_KEY= # = SUPABASE_ANON_KEY (protegida por RLS)
SUPABASE_SERVICE_ROLE_KEY=     # SOLO servidor

# --- App ---
APP_URL=                       # https://dominio-produccion
CRON_SECRET=                   # Bearer para /api/cron/despachar
NEGOCIO_NOMBRE=                # Opcional, para textos
COSTE_MINUTO_ESTIMADO=0.12     # Opcional, KPI de coste en dashboard
```

---

## 21. Preguntas abiertas para el negocio

1. **¿Llamadas comerciales o a clientes con relación previa?** → define 6xx vs 400 y la obligatoriedad de consentimiento. *(Bloqueante.)*
2. ¿Qué operador SIP y quién figura como titular (entidad con domicilio en España)?
3. Tipo de cita en Calendly: duración, ubicación (presencial/teléfono/vídeo), preguntas obligatorias, antelación mínima.
4. **Email**: si el contacto no tiene email o no quiere darlo, ¿se pide siempre, se usa un email del negocio, o no se agenda?
5. "Máximo 2 reintentos": ¿2 intentos en total o 1 inicial + 2 reintentos?
6. Tras una **cancelación** en Calendly, ¿a qué estado vuelve el contacto? (propuesta: `llamado` + seguimiento).
7. ¿Se acepta la tercera tool `no_llamar` para que la exclusión sea inmediata durante la llamada? (recomendado)
8. ¿Tratamiento de usted o de tú? ¿Nombre del asistente?
9. Respuesta preparada a "¿de dónde tenéis mi número?".
10. Política de retención de transcripciones (propuesta: 12 meses).
11. ¿Festivos autonómicos/locales a excluir además de los nacionales?
12. ¿Las llamadas individuales desde el panel pueden saltarse la franja horaria? (propuesta: no)
13. Usuarios internos a invitar y si alguno debe ser "admin" (configuración, borrados RGPD).

---

## 22. Fase 2 (fuera de alcance v1)

- Confirmación por SMS/WhatsApp tras agendar (y recordatorio previo).
- Llamadas entrantes (el mismo agente atendiendo devoluciones de llamada).
- Rellamada automática programada a la hora que pidió el contacto ("llámame el jueves por la tarde").
- Varios calendarios / tipos de evento / asignación round-robin.
- Integración con CRM.
- Analítica avanzada (embudos por lote, A/B de guiones, horarios con mejor contactabilidad).
- Roles y permisos más finos en el panel.

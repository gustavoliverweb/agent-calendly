# Plan: de un negocio a SaaS multi-cliente

Estado: **aprobado** (12/11/2026; actualizado con llamadas B2B y marca blanca). Hecho: **S1** (migración `20261112000000_multiempresa.sql`, pruebas `tests/db/aislamiento.sql`) **S2** sin el envío de emails (migración `20261113000000_admin_equipo.sql`; las invitaciones generan un enlace hasta que haya SMTP propio, `INVITACIONES_POR_EMAIL`) **S3** (migración `20261114000000_guiones.sql`; la voz queda fija hasta que el cliente elija voces) **S4** (migración `20261116000000_calendly_oauth.sql`; conexión y tipo de evento probados con una cuenta Sandbox, falta la prueba de reserva por voz) y **S5** (migración `20261117000000_telefono_limites.sql`; sin probar con una línea SIP real). Parte de la app actual (PLAN.md, fases 1–7 hechas y probadas con ElevenLabs y Calendly reales) y la convierte en un SaaS donde cada negocio (empresa) tiene sus datos, su guion, su calendario y su línea, aislados del resto.

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Modelo | SaaS multi-cliente: una sola app, una sola base de datos, datos separados por empresa |
| Altas | **Por invitación**: el proveedor crea la empresa y su primer usuario; no hay registro abierto |
| Cobro | **Fuera de la app** en v1. La app mide minutos, llamadas y citas por empresa para facturar por uso |
| Telefonía | **Cada negocio aporta su línea SIP**; el proveedor la da de alta en ElevenLabs y la asigna a la empresa |
| Calendly | **OAuth** ("Conectar con Calendly"): cada empresa autoriza su cuenta; sin tokens pegados |
| A quién llama el agente | **A otras empresas** (llamadas B2B): recepción, persona que decide, cargo |
| Marca | **Marca blanca**: cada empresa entra al panel con su dominio, su logo y su nombre |

## 2. Arquitectura

```
llamadas.empresa-a.com ─┐                          ┌─ Supabase (una BD, RLS por empresa)
llamadas.empresa-b.com ─┼─ Una app en Render ──────┤
app.<marca-saas>.com ───┘  (la empresa se deduce   ├─ ElevenLabs: UN agente base + línea SIP de cada empresa
  (/admin del proveedor)    del dominio)           └─ Calendly: OAuth por empresa + webhook por empresa
```

### 2.1 ElevenLabs: un agente base para todas las empresas
- **Un solo agente** en la cuenta del proveedor, con las tools, el análisis (data collection) y el webhook post-llamada actuales. No se crea un agente por empresa: evita sincronizar N agentes y sus tools.
- **El guion de cada empresa viaja en cada llamada.** El system prompt del agente queda fijo con la parte técnica (tools, errores, fechas, reglas legales) y la parte del negocio entra como **variable dinámica** (`{{guion_negocio}}`, más `{{negocio}}`, `{{nombre_agente}}`), que es lo que ElevenLabs recomienda. El **primer mensaje** también va como variable (`{{primer_mensaje}}`, ya montado por la app), así que no necesita override. Solo la **voz** irá como override por llamada (`conversation_config_override`), cuando haya varias para elegir; hay que activarla en la pestaña Security del agente (desactivada por defecto; si no, la llamada da error).
- **Probar en el navegador** (hecho en S3): el servidor pide a ElevenLabs una URL firmada y el navegador abre la conversación por WebSocket con `@elevenlabs/client`, con las mismas variables que una llamada real. La llamada se crea con `crear_llamada(..., p_prueba => true)`, así que las tools y el webhook post-llamada funcionan igual. Las variables las envía el navegador: un miembro podría cambiarlas, pero solo en su propia prueba (el `llamada_id` es un uuid de su empresa que no puede adivinar en otra).
- **Cada empresa tiene su número**: su troncal SIP se importa en ElevenLabs (lo hace el proveedor desde su cuenta) y el `phone_number_id` resultante se guarda en la empresa. El dispatcher llama con el número de la empresa del contacto.
- **Tools y webhook siguen siendo comunes**: la empresa se deduce del `llamada_id` (variable dinámica que ya se envía), nunca de lo que diga el LLM.
- Pendiente de medir con la prueba en el navegador: tamaño máximo de una variable dinámica (no documentado; el panel limita el guion a 8.000 caracteres) y latencia con un guion largo.

### 2.2 Calendly: OAuth por empresa
- Una **app OAuth** del proveedor en Calendly (Developer tools → OAuth apps): client ID, client secret y clave de firma de webhooks. PKCE obligatorio; una sola redirect URI (`https://<dominio>/api/calendly/oauth/callback`).
- Por empresa se guardan **access token** (dura 2 h) y **refresh token**, **cifrados** en BD. La renovación es de **un solo uso**: cada refresh devuelve un refresh token nuevo que sustituye al anterior; se serializa con un bloqueo por empresa para que dos peticiones a la vez no invaliden el token.
- Tras conectar, la empresa **elige el tipo de evento** en una lista y la app lee su **ubicación** (la primera del tipo; sustituye a `CALENDLY_EVENT_TYPE_URI` y `CALENDLY_LOCATION_KIND`). Los scopes que necesita la app: `users:read`, `event_types:read`, `scheduled_events:read`, `scheduled_events:write`, `webhooks:read`, `webhooks:write` (Calendly exige los `:read` aunque su documentación diga que `:write` los incluye).
- **Webhook por empresa**, creado automáticamente al conectar, hacia `/api/webhooks/calendly/<empresa>`: la URL identifica la empresa y la firma usa la clave de la app OAuth. Se crea con alcance usuario (o organización si quien conecta es admin de su organización Calendly).
- La reserva por API exige que **la cuenta Calendly de la empresa sea de pago** (Standard o superior); el panel lo avisa si recibe 403. Límite: 100 reservas/día por usuario de Calendly.
- Si un refresh falla (`invalid_grant`), la empresa queda "Calendly desconectado": aviso en su panel y las tools responden "le llamaremos" como hoy.

### 2.3 Aislamiento de datos
- Todas las tablas de negocio llevan `empresa_id` (not null, con índice). **RLS**: un usuario solo ve filas de las empresas de las que es miembro. Las funciones `security definer` reciben o deducen la empresa y la comprueban.
- El código de servidor que usa la service role (tools, webhooks, cron) **filtra siempre por la empresa** deducida de la llamada o de la URL. Tests de aislamiento: un usuario de A no puede leer, modificar ni lanzar nada de B (BD y endpoints).
- Secretos por empresa (tokens de Calendly) cifrados con una clave de la app (`ENCRYPTION_KEY` en Render), nunca en claro ni en logs.

## 3. Modelo de datos (cambios)

Tablas nuevas:

| Tabla | Contenido |
|---|---|
| `empresas` | nombre, slug, estado (`activa`/`suspendida`), zona horaria (Europe/Madrid por defecto), `phone_number_id`, límites (minutos/mes, concurrencia máx.), marca (logo, color, favicon, datos legales) |
| `dominios_empresa` | dominio, empresa, estado de verificación y del certificado |
| `miembros` | usuario ↔ empresa, rol (`propietario`, `operador`); un usuario puede estar en varias empresas |
| `invitaciones` | email, empresa, rol, token de un solo uso, caducidad |
| `guiones` | versión del guion de la empresa (campos estructurados + texto final), autor, fecha; la activa se usa en las llamadas |
| `integraciones_calendly` | tokens cifrados, caducidad, usuario/organización Calendly, tipo de evento elegido, ubicación, URI del webhook, estado |
| `uso_mensual` (vista o tabla) | minutos, llamadas, citas y coste estimado por empresa y mes |
| `admins_plataforma` | usuarios del proveedor con acceso a `/admin` |

Tablas existentes que pasan a llevar `empresa_id`: `contactos`, `llamadas`, `citas`, `lotes`, `lote_items`, `configuracion` (una fila por empresa en vez de una global), `auditoria`, `eventos_webhook`. Unicidad por empresa (p. ej. teléfono único **dentro** de cada empresa, no global).

Lista **"no llamar"**: por empresa (la oposición se ejerce frente a quien llama). A decidir si además se mantiene una lista global de la plataforma (§10).

Migración de datos: lo existente pasa a una primera empresa ("Clínica Sonrisa (demo)").

## 4. Panel

### 4.1 Para cada empresa (`/app`)
| Sección | Novedad |
|---|---|
| Inicio, Contactos, Lotes, Llamadas | Igual que hoy, filtrado por empresa |
| **Guion** (nueva) | Formulario por apartados: negocio y a qué se dedica, motivo de la llamada, oferta, dónde/cómo es la cita, preguntas frecuentes, objeciones propias, lo que el agente no debe decir; nombre del agente, primer mensaje y voz (lista cerrada). Vista previa del texto final, historial de versiones y botón **"Probar en el navegador"** (crea una llamada de prueba y abre el tester con las variables, como `pnpm llamada-prueba`) |
| **Calendly** (nueva) | Conectar / desconectar, cuenta conectada, tipo de evento, ubicación, estado del webhook |
| **Teléfono** (nueva, solo lectura) | Número asignado y estado; si no hay, explica cómo pedir el alta de la línea |
| **Marca** (nueva) | Nombre, logo, color, favicon y datos legales de la empresa; dominio propio (solo lectura, lo da de alta el proveedor) |
| **Equipo** (nueva) | Invitar y quitar usuarios de la empresa (solo propietario) |
| **Uso** (nueva) | Minutos, llamadas, citas y coste estimado del mes; límite contratado |
| Configuración | Igual que hoy (franjas, festivos, reintentos…), por empresa |

El panel no deja lanzar llamadas hasta que la empresa tenga guion, Calendly conectado y teléfono asignado (lista de pasos pendientes en Inicio).

### 4.2 Para el proveedor (`/admin`)
- Crear empresa e invitar a su propietario.
- Asignar el `phone_number_id` de su línea y su **dominio propio**, suspender / reactivar, fijar límites.
- Uso por empresa y mes (exportable a CSV para facturar).
- Ver estado de integraciones de cada empresa (sin ver sus datos personales salvo soporte explícito).

### 4.3 Marca blanca: dominio y marca de cada empresa
- **Dominio propio por empresa** (p. ej. `llamadas.empresa-a.com`): la empresa crea un CNAME hacia Render y el proveedor lo da de alta desde `/admin`, que lo añade al servicio de Render por su API (certificado HTTPS automático). Mientras no tenga dominio propio, entra por un subdominio de la plataforma (`empresa-a.<marca-saas>.com`).
- **La empresa se deduce del dominio** en cada petición (`proxy.ts`): un usuario solo puede iniciar sesión en el dominio de una empresa de la que es miembro. Las sesiones son por dominio.
- **Marca por empresa**: nombre, logo, color principal y favicon, editables en el panel (sección **Marca**); se aplican al login, al panel y a los emails.
- **Emails** (invitaciones, recuperar contraseña) con el nombre y el logo de la empresa. Por defecto salen desde el dominio de la plataforma con el nombre de la empresa como remitente; enviar desde el dominio de la empresa exige verificar su DNS en el proveedor de email (opcional, más adelante).
- **Supabase Auth**: cada dominio nuevo se añade a las URLs de redirección permitidas (automático desde `/admin` con la API de gestión de Supabase).
- **Calendly OAuth** admite una sola redirect URI: el botón "Conectar" pasa por el dominio de la plataforma y vuelve al dominio de la empresa al terminar.
- **El dominio principal** (`<marca-saas>.com`) muestra la landing del SaaS y el acceso de `/admin`; los dominios de empresa van directos a su login.
- **Páginas legales**: las de la plataforma en el dominio principal; en el dominio de cada empresa, aviso legal y privacidad con los datos de esa empresa (campos en su sección Marca).

## 5. Llamadas a empresas (B2B)
- **Contactos**: nuevos campos **empresa** (obligatorio), **cargo**, **sector** y **web**; el teléfono puede ser la centralita. Plantilla de importación CSV actualizada.
- **Guion B2B** (parte fija del prompt): si contesta recepción, presentarse brevemente y pedir que le pasen con la persona (o el cargo) indicada; si no está, preguntar cuándo localizarla o un contacto directo; no dar detalles comerciales a recepción más allá de lo necesario; confirmar con quién se habla y su cargo. Los apartados del negocio (oferta, objeciones…) siguen en el formulario de cada empresa.
- **Datos recogidos** nuevos en el análisis: `hablo_con_decisor`, `nombre_contacto`, `cargo_contacto`, `telefono_directo`, `mejor_momento`; un **pase a otra persona** se registra como seguimiento con esos datos.
- **Clasificación** nueva: "pasado a otra persona" / "decisor no disponible" además de las actuales.
- **Legal**: llamar a empresas tiene reglas distintas a llamar a particulares (el consentimiento previo de la Ley de Telecomunicaciones protege a personas físicas; los datos del empleado que atiende siguen sujetos al RGPD y la oposición "no me llaméis" se respeta igual). El tipo de campaña "B2B" permitirá base jurídica de **interés legítimo** con su origen documentado, en lugar de exigir consentimiento. **Revisar con el asesor** antes de activar este modo (también si se llama a autónomos, que son personas físicas).

## 6. Llamadas y motor de lotes
- El dispatcher reparte entre empresas: respeta la **concurrencia de cada empresa** y la **global** del plan de ElevenLabs (compartida por todas), con turnos justos para que una empresa con un lote grande no bloquee a las demás.
- Franjas horarias, festivos y reintentos, por empresa (zona horaria de la empresa).
- **Límite de minutos al mes** por empresa: al alcanzarlo, no salen más llamadas y el panel lo avisa (control de coste, ya que la factura de ElevenLabs la paga el proveedor).
- Cada llamada guarda la versión de guion usada (para auditar qué dijo el agente).

## 7. Email
Las invitaciones necesitan **email propio** (hoy Auth no tiene SMTP): un proveedor transaccional (p. ej. Resend, Postmark o Brevo) con el dominio del SaaS, configurado en Supabase Auth. También habilita "olvidé mi contraseña".

## 8. Legal (RGPD)
- El proveedor es **encargado del tratamiento** de cada empresa: contrato de encargo (art. 28) en el alta, con la lista de subencargados (Supabase, Render, ElevenLabs, Calendly, proveedor de email).
- Cada empresa es responsable de sus contactos y de su consentimiento; la importación sigue exigiendo consentimiento con fecha y origen.
- Supresión y retención, por empresa. Las páginas legales pasan a ser las del SaaS (los textos actuales ya contemplan el papel de encargado).

## 9. Fases y estimación

| Fase | Contenido | Estimación |
|---|---|---|
| S1 | Base multi-empresa: tablas, `empresa_id`, RLS, RPCs, migración de datos, tests de aislamiento | 1,5–2 semanas |
| S2 | Admin del proveedor, invitaciones, equipo, email (SMTP) | 1 semana |
| S3 | Guion en el panel, variables/overrides por llamada, "Probar en el navegador" | 1 semana |
| S4 | Calendly OAuth, tipo de evento, webhook por empresa, renovación de tokens | 1–1,5 semanas |
| S5 | Teléfono por empresa, dispatcher multi-empresa, límites de uso | 1 semana |
| S6 | Uso y exportación para facturar | 0,5 semanas |
| S6b | Marca blanca: dominios por empresa, marca en login/panel/emails, páginas legales por empresa | 1,5–2 semanas |
| S6c | Modo B2B: campos de contacto, guion de recepción/decisor, datos recogidos y clasificación nuevos, tipo de campaña B2B | 1 semana |
| S7 | Pruebas e2e, aceptación con dos empresas reales o de prueba, documentación y guía de alta | 1 semana |
| | **Total** | **~10–11 semanas** |

Orden pensado para que la app siga funcionando para la empresa actual al final de cada fase.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Fuga de datos entre empresas | RLS en todas las tablas + filtro explícito en código con service role + tests de aislamiento en CI |
| Una empresa agota la concurrencia o los minutos del plan de ElevenLabs | Concurrencia y minutos máximos por empresa; reparto justo en el dispatcher |
| Guion de una empresa que incumpla normas (no identificarse como IA, prometer cosas) | La parte legal del prompt es fija y no editable; el primer mensaje exige identificarse como asistente virtual (validación al guardar) |
| Refresh de Calendly invalidado por concurrencia | Bloqueo por empresa al renovar; estado "desconectado" visible y reconexión en un clic |
| Alta lenta de líneas SIP por empresa | Checklist de alta; la empresa puede preparar guion, Calendly y contactos mientras llega la línea |
| Dominio de una empresa mal configurado (DNS) | Estado de verificación visible en `/admin`; la empresa sigue entrando por su subdominio de la plataforma |
| Mezcla de sesiones o marcas entre dominios | Empresa resuelta solo desde el dominio en el servidor; tests que entran por dos dominios |
| Coste fijo de ElevenLabs creciendo con varias empresas | Medición por empresa desde el día 1; plan de ElevenLabs revisado según el uso agregado |

## 11. Preguntas abiertas

1. **Marca y dominio de la plataforma** (sustituyen a "Cadencia" y `hola@example.com`): los usa la landing, `/admin` y los subdominios por defecto de las empresas.
2. **Proveedor de email** transaccional (Resend, Postmark, Brevo…).
3. **Lista "no llamar" global** de la plataforma además de la de cada empresa: ¿si alguien pide no ser llamado por una empresa, se bloquea también para las demás? (Recomendado: no; solo por empresa, salvo que se quiera una política más estricta.)
4. **Límites por defecto** de cada empresa (minutos/mes, llamadas simultáneas).
5. **Voces disponibles** para elegir en el panel (lista cerrada de voces en castellano).
6. ¿El proveedor necesita **entrar al panel de una empresa** para dar soporte? (Requiere modo soporte con auditoría.)
7. **Llamadas B2B y autónomos**: ¿se llamará también a autónomos (personas físicas)? Afecta a la base jurídica (consentimiento frente a interés legítimo); confirmar con el asesor.
8. **Límite de dominios en Render**: confirmar cuántos dominios propios admite el plan del cliente en un mismo servicio.

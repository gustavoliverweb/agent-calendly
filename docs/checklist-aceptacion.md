# Checklist de aceptación (S7)

Pruebas para dar por buena la plataforma multiempresa antes de dar de alta clientes reales. Recoge la QA que quedó aplazada en S4–S6c: voz real, Calendly en producción, línea SIP, B2B y marca blanca.

Cómo usarla:

- Marca cada casilla al comprobar el **resultado esperado**. Si algo falla, anota la fecha y el ID de la llamada o del contacto.
- Las pruebas marcadas con **(e2e)** se automatizarán en la fase de QA con Playwright, usando ElevenLabs y Calendly simulados. Las demás necesitan servicios reales o una persona al teléfono.
- Ninguna prueba debe usar teléfonos de clientes reales: solo números del equipo.

## Preparación

Dos empresas de prueba, dadas de alta con la [guía de alta](guia-alta.md):

| | Empresa A | Empresa B |
|---|---|---|
| Uso | Particulares (clínica) | Otras empresas (B2B) |
| Campaña | Comercial | B2B (habilitado en `/admin`) |
| Calendly | Una cuenta de pago | Otra cuenta distinta |
| Línea | Línea SIP real | La misma u otra línea |
| Usuarios | Propietario A y operador A | Propietario B |
| Contactos | 5 teléfonos del equipo, con consentimiento | 3 teléfonos del equipo, con empresa y origen de los datos |

Necesitas además:

- [ ] La tarea programada (pg_cron) activa en producción.
- [ ] La app OAuth de Calendly de producción configurada.
- [ ] Alguien con micrófono o teléfono para las pruebas de voz.

## 1. Alta, acceso y roles

- [ ] **(e2e)** Crear una empresa en `/admin` genera el enlace de invitación, y con él el propietario elige contraseña y entra en `/app`.
- [ ] **(e2e)** El propietario invita a un operador desde **Equipo**, y el operador entra con su enlace.
- [ ] **(e2e)** El operador **no** puede editar **Guion**, **Calendly**, **Marca** ni **Equipo**, y **sí** puede gestionar contactos, lotes, llamadas y configuración.
- [ ] **(e2e)** No se puede quitar ni degradar al último propietario de una empresa.
- [ ] **(e2e)** Un usuario sin permiso de administrador que abre `/admin` no ve nada de la plataforma.
- [ ] Suspender la empresa A en `/admin`: su panel muestra el aviso, se puede consultar, pero ninguna llamada sale (ni manual ni de lote). Al reactivar, todo vuelve a funcionar.

## 2. Aislamiento entre empresas

- [ ] **(e2e)** El propietario A no ve en ninguna sección contactos, llamadas, lotes, guiones ni uso de B (y al revés).
- [ ] **(e2e)** Abrir con la sesión de A la URL de un contacto, una llamada o un lote de B (copiando su ID) da «no encontrado».
- [ ] **(e2e)** Importar en A un CSV con un teléfono que ya existe en B lo importa sin avisar de duplicado: los datos de cada empresa son independientes.
- [ ] `pnpm db:test` pasa sin errores contra la base de producción (lo hace todo dentro de una transacción que se deshace).

## 3. Guion y prueba en el navegador

- [ ] **(e2e)** Un primer mensaje sin «asistente virtual» o sin aviso de transcripción no se puede guardar, y el mensaje de error dice qué falta.
- [ ] **(e2e)** Cada vez que se guarda se crea una versión nueva, y activar una versión antigua la vuelve a dejar activa.
- [ ] **Probar en el navegador** con el guion de A: el agente saluda con el primer mensaje, contesta con la información del guion y no inventa precios ni datos que no están.
- [ ] Los minutos de esa prueba aparecen en **Uso** de A, y no en B.

## 4. Calendly (OAuth en producción)

- [ ] El propietario A conecta su Calendly, elige el tipo de evento y la sección muestra «Conectado».
- [ ] El propietario B conecta **otra** cuenta: cada empresa reserva solo en la suya.
- [ ] Revocar la app desde Calendly (Integraciones) deja la empresa en «Desconectado» en su panel y en `/admin`, y «Volver a conectar» lo recupera con el mismo tipo de evento.
- [ ] Conectar Calendly desde el dominio propio de una empresa (apartado 9) vuelve a ese mismo dominio al terminar.

## 5. Llamada real (voz y línea SIP)

Con la empresa A, llamada manual desde la ficha de un contacto del equipo:

- [ ] El teléfono suena, se ve el número de la línea de A y el agente dice el primer mensaje.
- [ ] **Reserva**: el agente ofrece huecos reales, confirma el email, reserva, y llega la confirmación de Calendly. En el panel: llamada «Cita agendada», cita «activa» y contacto con cita.
- [ ] **Hueco ocupado**: ocupar a mano en Calendly el hueco elegido justo antes de confirmarlo. El agente avisa y ofrece otro sin colgar.
- [ ] **Cambio de hora** desde el email de Calendly: la cita antigua pasa a «reprogramada» y la nueva a «activa».
- [ ] **Cancelación** desde el email: la cita pasa a «cancelada» y el contacto queda en seguimiento por cita cancelada.
- [ ] **Rellamar**: decir «llámame el lunes por la mañana». La llamada queda como «Pide rellamada» y el contacto, en seguimiento con ese momento.
- [ ] **No llamar**: decir «no me llaméis más». El contacto pasa a «no llamar» y desaparece de los lotes en marcha.
- [ ] **No contesta y buzón**: dejar sonar sin descolgar, y otra vez dejando saltar el buzón. Se reintenta según la configuración, y al agotar los intentos queda «no contesta».
- [ ] La transcripción y el resumen están en español y los **datos recogidos** aparecen en la ficha de la llamada.

## 6. Lotes y tarea programada

- [ ] **(e2e)** Al crear un lote se excluyen, con su motivo visible: «no llamar», con cita, sin consentimiento (campaña comercial) y los que ya están en otro lote.
- [ ] Un lote de 5 contactos con 2 llamadas simultáneas nunca tiene más de 2 llamadas a la vez.
- [ ] Fuera de las franjas horarias o en un festivo, el lote espera y no sale ninguna llamada. Al entrar en franja, arranca solo.
- [ ] **Pausar** un lote deja terminar las llamadas en curso y no lanza más. **Cancelarlo** retira lo pendiente.
- [ ] La **pausa global** de A para A, pero no para B.
- [ ] **Reparto justo**: lanzar a la vez un lote grande en A y uno pequeño en B. B no espera a que termine A.
- [ ] **Concurrencia global**: con la de `/admin` en 2 y lotes activos en A y B, nunca hay más de 2 llamadas en curso en total.
- [ ] Parar la tarea programada unos minutos con un lote activo: el Resumen avisa de que no se ejecuta.

## 7. Límites y uso

- [ ] Con el límite de minutos de A en un valor bajo, al alcanzarlo no sale ninguna llamada ni prueba en el navegador, y el panel avisa. B sigue llamando.
- [ ] Las llamadas simultáneas de A en **Configuración** no pueden superar las contratadas en `/admin`.
- [ ] **(e2e)** **Uso** de A muestra minutos, llamadas, citas e importe con su tarifa. El CSV de detalle no lleva nombres ni teléfonos.
- [ ] `/admin` → **Uso y facturación**: el CSV para facturar tiene una fila por empresa y sus totales cuadran con lo que ve cada empresa.

## 8. Campaña B2B (empresa B)

- [ ] **(e2e)** Sin B2B habilitado en `/admin`, la empresa no puede elegir el tipo de campaña B2B.
- [ ] **(e2e)** Importar la plantilla B2B con empresa, cargo y origen de los datos. Un lote B2B excluye los contactos sin empresa u origen.
- [ ] Llamada real en la que alguien hace de **recepción**: el agente se presenta como asistente virtual, pide que le pasen con la persona o el cargo indicado y no da detalles comerciales.
- [ ] Al «pasarle» con otra persona, el agente vuelve a presentarse y avisa de la transcripción.
- [ ] **Decisor no disponible**: la llamada queda así clasificada, con el mejor momento y el teléfono directo en los datos recogidos, y el contacto en seguimiento.
- [ ] **Pasado a otra persona**: queda clasificada así, con el nombre y el cargo de la persona indicada.

## 9. Marca blanca y dominio propio

- [ ] El propietario B sube logo, color y favicon en **Marca**: el login y el panel los muestran. Un SVG o una imagen de más de 512 KB se rechazan.
- [ ] Añadir un dominio de prueba en `/admin` → **Dominios** y crear su CNAME. Pasa a «Verificado» y abre con HTTPS.
- [ ] En ese dominio, `/` lleva al login de B con su marca, la web de la plataforma da 404 y `/admin` no existe.
- [ ] El propietario A no puede entrar en el dominio de B: su sesión no sirve allí.
- [ ] `/aviso-legal`, `/privacidad` y `/cookies` en el dominio de B muestran los datos legales de B.
- [ ] Un enlace de invitación generado para B usa su dominio.
- [ ] En Render, la app recibe el dominio público en `X-Forwarded-Host`: las redirecciones no llevan a `onrender.com`.

## 10. Protección de datos

- [ ] **Borrar contacto** en A elimina el contacto, sus llamadas y transcripciones, y su conversación en ElevenLabs. La cita de Calendly no se toca.
- [ ] Con el plazo de conservación en 1 día, tras la tarea nocturna las transcripciones antiguas se borran y se conservan estado, duración y cita.
- [ ] En la auditoría quedan registrados el borrado, la purga, la pausa global y la suspensión.

## 11. Web pública

- [ ] **(e2e)** Todas las páginas de la web cargan (inicio, producto, precios, seguridad, integraciones, calculadora, recursos, contacto, las 5 soluciones y las 3 guías) y una dirección inexistente da 404.
- [ ] **(e2e)** El formulario de contacto exige nombre, email y aceptar la privacidad. Al enviarlo, la solicitud aparece en `/admin` → **Solicitudes** con su origen y sector.
- [ ] **(e2e)** En móvil, el menú se abre, navega y se cierra con Escape.
- [ ] El formulario de contacto funciona en producción (Render) y no en local.
- [ ] La calculadora no envía datos a ningún sitio (pestaña Red del navegador vacía al cambiar valores).

## Cierre

- [ ] Todas las casillas marcadas, o con su incidencia anotada y aceptada.
- [ ] Las incidencias encontradas, corregidas y vueltas a probar.
- [ ] Las pruebas marcadas **(e2e)**, automatizadas en la fase de QA y en verde.

# Guía de alta de una empresa

Pasos para poner en marcha una empresa cliente, desde que firma hasta su primera campaña. Los detalles de operación (rotar secretos, facturar, dominios) están en el [runbook](runbook.md).

Hay dos papeles:

- **Proveedor**: quien administra la plataforma desde `/admin`.
- **Propietario**: la persona de la empresa que gestiona su cuenta desde `/app`.

## 0. Antes de la primera empresa (una sola vez)

Comprueba que la plataforma está lista:

- [ ] La tarea programada de los lotes funciona ([configuracion-cron.md](configuracion-cron.md)). Sin ella, los lotes no avanzan.
- [ ] El agente de ElevenLabs tiene el prompt de [system-prompt.md](system-prompt.md), las 3 tools, el webhook post-llamada y los campos de *data collection* ([configuracion-elevenlabs.md](configuracion-elevenlabs.md)).
- [ ] La app OAuth de Calendly es la de **producción** y no la Sandbox ([configuracion-calendly.md](configuracion-calendly.md), apartado 0).
- [ ] En `/admin`, la **concurrencia global** coincide con las conversaciones simultáneas del plan de ElevenLabs.

## 1. Qué pedir a la empresa

Pídelo todo al principio: la línea de teléfono es lo que más tarda, y mientras llega la empresa puede ir preparando lo demás.

| Qué | Para qué | Obligatorio |
|---|---|---|
| Nombre comercial | Nombre de la empresa en el panel | Sí |
| Identificador corto (p. ej. `clinica-sonrisa`) | Subdominio por defecto. **No se puede cambiar después** | Sí |
| Email del propietario | Para enviarle la invitación | Sí |
| Cuenta de Calendly de pago y tipo de evento | Las citas se reservan ahí. El plan gratuito no permite reservar desde otra aplicación | Sí |
| Datos de la línea SIP (operador, número, servidor, usuario, contraseña) | Las llamadas salen desde su número. Por un canal seguro, nunca por email en claro | Sí |
| Información para el guion | A qué se dedica, por qué llama, qué ofrece, qué cita busca, preguntas frecuentes y objeciones | Sí |
| Tipo de campaña y base jurídica | Comercial (con consentimiento), no comercial (clientes propios) o B2B. Lo decide con su asesor | Sí |
| Horario de llamadas, festivos y reintentos | Configuración de los lotes | Sí (hay valores por defecto) |
| Minutos al mes y llamadas simultáneas | Límites de la cuenta | Sí |
| Tarifa por minuto (EUR) | Facturación | Sí |
| Lista de contactos en CSV | Primera campaña | Para lanzar |
| Contrato de encargo del tratamiento (art. 28 RGPD) | El proveedor trata sus datos por encargo | Sí, firmado antes de importar contactos |
| Logo, color, datos legales y dominio | Marca blanca | Solo si la quiere |

## 2. Crear la empresa (proveedor)

1. `/admin` → **Nueva empresa**: nombre, identificador y email del propietario.
2. Mientras no haya proveedor de email, la plataforma muestra un **enlace de invitación** en lugar de enviarlo. Cópialo y mándaselo al propietario por un canal de confianza. Es personal y caduca: si caduca, genera otro desde la ficha de la empresa → **Equipo**.
3. En la ficha de la empresa → **Línea, límites y tarifa**:
   - **Línea**: primero da de alta el número en ElevenLabs (runbook → [Alta de la línea de una empresa](runbook.md#alta-de-la-línea-de-una-empresa)) y luego elígelo aquí. Puedes dejarlo en «Sin línea» hasta que llegue: la empresa puede preparar todo lo demás.
   - **Llamadas simultáneas contratadas**: el máximo. La empresa puede configurar menos, nunca más.
   - **Minutos al mes**: al llegar al límite no sale ninguna llamada (tampoco las pruebas en el navegador) hasta el mes siguiente.
   - **Tarifa por minuto**: sin tarifa, la empresa solo ve minutos y su importe no suma en la facturación.
4. **Llamadas a empresas (B2B)**: actívalo solo si la empresa va a llamar a otras empresas y su asesor ha revisado la base jurídica. Sin activarlo, la empresa no puede elegir el tipo de campaña B2B.

## 3. Configurar la cuenta (propietario)

Este es el orden recomendado. Los apartados marcados como *solo propietario* no los puede tocar un operador.

1. **Entrar**: abre el enlace de invitación y elige una contraseña.
2. **Guion** (*solo propietario*):
   - Rellena los apartados: los cuatro primeros son obligatorios. La guía [Cómo escribir el guion de tu agente](/recursos/como-escribir-el-guion) de la web explica qué poner en cada uno.
   - El primer mensaje tiene que decir que habla una asistente virtual y que la llamada se transcribe. Si falta algo, el panel no deja guardar.
   - **Probar en el navegador** varias veces y, cuando convenza, activar esa versión.
3. **Calendly** (*solo propietario*): **Conectar**, iniciar sesión en Calendly y elegir el tipo de evento.
4. **Teléfono**: cuando el proveedor asigna la línea, aparece como «Activa».
5. **Configuración**: tipo de campaña, franjas horarias, festivos, reintentos, llamadas simultáneas y plazo de conservación de las transcripciones.
6. **Equipo** (*solo propietario*): invitar a los operadores, que pueden gestionar contactos, lotes, llamadas y configuración.
7. **Marca** (*solo propietario*, opcional): logo, color, favicon y datos legales para la marca blanca.
8. **Contactos**: importar el CSV. La guía [Cómo preparar tu lista de contactos](/recursos/preparar-lista-de-contactos) de la web lo explica, y para B2B hay una plantilla descargable en la propia página de importación.

## 4. Comprobar antes de la primera campaña (proveedor y propietario)

- [ ] En `/admin`, la empresa aparece con Calendly «Conectado», guion activo y línea asignada.
- [ ] Una **llamada manual** desde la ficha de un contacto con el teléfono de alguien del equipo:
  - el agente se presenta con el primer mensaje del guion;
  - ofrece huecos reales del Calendly y reserva la cita;
  - el email de confirmación de Calendly llega al correo indicado.
- [ ] En **Llamadas** aparece la transcripción, el resumen y la clasificación «Cita agendada».
- [ ] Al cancelar la cita desde el email de Calendly, la cita pasa a «cancelada» en el panel y el contacto queda en seguimiento.
- [ ] Un **lote de prueba** con 3–5 contactos internos, dentro del horario configurado: avanza solo y respeta las llamadas simultáneas.
- [ ] En **Uso**, los minutos de esas pruebas aparecen sumados.

Con todo marcado, la empresa puede lanzar su primera campaña real. Conviene empezar con un lote pequeño y leer las transcripciones antes de lanzar el resto.

## 5. Dominio propio (opcional)

Si la empresa quiere entrar por su dominio, sigue el runbook → [Dominio propio de una empresa](runbook.md#dominio-propio-de-una-empresa-marca-blanca). Su sesión es por dominio, así que la primera vez sus usuarios tendrán que iniciar sesión de nuevo.

## 6. Suspender o dar de baja

- **Suspender** (ficha en `/admin`): la empresa no puede hacer ninguna llamada, pero sigue pudiendo consultar su panel y descargar su uso. **Reactivar** la deja como estaba.
- **Baja definitiva**: con el contrato de encargo terminado, exporta lo que la empresa necesite y borra sus datos. Hoy no hay botón de borrado de empresa, así que se hace desde Supabase → SQL Editor:

  1. Borra antes sus conversaciones en ElevenLabs (runbook → [Derecho de supresión](runbook.md#derecho-de-supresión-rgpd)) y quita su dominio de Render.
  2. Ejecuta:

     ```sql
     delete from public.empresas where slug = 'identificador-de-la-empresa';
     ```

     El borrado en cascada elimina su configuración, miembros, contactos, llamadas, citas, lotes, guiones, conexión de Calendly, dominios y auditoría.
  3. Los usuarios no se borran, porque pueden pertenecer a otra empresa. Si alguno ya no pertenece a ninguna, bórralo en Supabase → Authentication → Users.

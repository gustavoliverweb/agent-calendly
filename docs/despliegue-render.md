# Despliegue en Render

La app se despliega como un **servicio web Node** en Render, región **Fráncfort** (junto a Supabase), con una instancia **Starter** (0,5 CPU, 512 MB, siempre encendida). La configuración está en [`render.yaml`](../render.yaml) (Blueprint); Node se fija en 24 con [`.node-version`](../.node-version).

Cada `git push` a la rama principal despliega solo. El motor de lotes no usa el cron de Render: lo dispara pg_cron desde Supabase ([configuracion-cron.md](configuracion-cron.md)).

## Antes de empezar

- La cuenta de Render del cliente tiene que poder leer el repositorio: conecta GitHub/GitLab en Render (**Account settings → Git**) con una cuenta que tenga acceso al repo, o da acceso al repo a la cuenta del cliente.
- Ten a mano los valores de `.env.local`. **No** se usan en Render: `SUPABASE_PROJECT_REF` y `SUPABASE_DB_PASSWORD` (solo para la CLI) ni `ELEVENLABS_API_BASE` / `CALENDLY_API_BASE` (solo para pruebas con mocks).

## 1. Crear el servicio desde el Blueprint

1. Render → **New → Blueprint**.
2. Elige el repositorio y la rama principal. Render detecta `render.yaml` y propone el servicio `agent-calendly`.
3. Render pide el valor de cada variable marcada como secreta. Rellénalas con las de `.env.local`, salvo:
   - `APP_URL`: pon `https://agent-calendly.onrender.com`. Si Render asigna otra URL (cuando el nombre ya está cogido añade un sufijo), corrígela en el paso 2.
   - `ELEVENLABS_PHONE_NUMBER_ID`: puede ir vacía hasta tener la línea SIP.
4. **Apply**. El primer build tarda unos minutos.

## 2. Comprobar el despliegue

- En el servicio → **Events**, el deploy debe acabar en *Live*. Si falla, el motivo está en **Logs**.
- Abre la URL `https://<servicio>.onrender.com`: debe verse la landing, y `/login` el acceso al panel.
- Si la URL real no coincide con `APP_URL`: **Environment** → corrige `APP_URL` → *Save, rebuild, and deploy*.
- Comprueba una tool desde tu PC (debe devolver huecos de Calendly):

  ```bash
  curl -X POST https://<servicio>.onrender.com/api/tools/disponibilidad \
    -H "Authorization: Bearer $TOOLS_SECRET" -H "Content-Type: application/json" -d '{}'
  ```

## 3. Supabase Auth

**Authentication → URL Configuration**:

- **Site URL**: la URL pública (`https://<servicio>.onrender.com` o el dominio).
- **Redirect URLs**: añade `https://<servicio>.onrender.com/**` (y el dominio cuando lo haya). Mantén `http://localhost:3000/**` para desarrollo.

## 4. Apuntar los servicios externos a Render

Con una URL fija ya no hace falta el túnel para probar el agente.

| Servicio | Qué cambiar |
|---|---|
| ElevenLabs, tools | URL de `disponibilidad`, `agendar` y `no_llamar` → `https://<url>/api/tools/...` |
| ElevenLabs, webhook post-llamada | La URL de un webhook no se puede editar: crea uno nuevo hacia `https://<url>/api/webhooks/elevenlabs`, asígnalo al agente y guarda su secreto en `ELEVENLABS_WEBHOOK_SECRET` (en Render y en `.env.local`) |
| Calendly | `pnpm calendly crear-webhook https://<url>/api/webhooks/calendly` (requiere plan de pago) |
| Supabase pg_cron | El SQL de [configuracion-cron.md](configuracion-cron.md) con `app_url` = la URL pública y el mismo `CRON_SECRET` que en Render |

## 5. Dominio propio (cuando lo haya)

1. Servicio → **Settings → Custom Domains → Add**. Render indica el registro DNS (CNAME) y emite el certificado HTTPS solo.
2. Cambia `APP_URL` al dominio (*Save, rebuild, and deploy*).
3. Repite los pasos 3 y 4 con el dominio y actualiza `app_url` en Vault: `select vault.update_secret((select id from vault.secrets where name = 'app_url'), 'https://<dominio>');`.

## Día a día

- **Desplegar**: `git push` a la rama principal. Para desplegar a mano: **Manual Deploy → Deploy latest commit**.
- **Volver atrás**: **Events** → un deploy anterior → **Rollback**.
- **Variables**: **Environment**. Las `NEXT_PUBLIC_*` se incrustan al compilar, así que cambiarlas exige *Save, rebuild, and deploy*; el resto basta con *Save and deploy*.
- **Logs**: servicio → **Logs**. Son JSON con teléfonos y emails enmascarados.
- **Memoria**: **Metrics**. Si el uso se acerca a 512 MB o hay reinicios por memoria, sube la instancia a Standard (`plan: 1c-2g` en `render.yaml`).

## Si el build falla

- **Versión de pnpm**: el proyecto declara `packageManager: pnpm@12.9.1`. Si el pnpm preinstalado de Render no la acepta, cambia el `buildCommand` del servicio a `corepack enable && pnpm install --frozen-lockfile && pnpm build`.
- **Falta una variable**: la app valida las variables al usarlas; el error de los logs dice cuál falta.

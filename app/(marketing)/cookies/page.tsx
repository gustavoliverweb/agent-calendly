import Link from "next/link";
import { DocumentoLegal, metadataLegal } from "@/components/legal/documento-legal";
import { Dato } from "@/components/legal/huecos";
import { MARCA } from "@/lib/marca";

export const metadata = metadataLegal("Política de cookies", `Qué cookies usa el sitio web de ${MARCA.nombre}.`);

export default function Cookies() {
  return (
    <DocumentoLegal ruta="/cookies" titulo="Política de cookies">
      <h2>1. Qué son las cookies</h2>
      <p>
        Las cookies son pequeños archivos que una web guarda en tu navegador para recordar información entre una visita y
        la siguiente, por ejemplo que ya has iniciado sesión.
      </p>

      <h2>2. Qué cookies usamos</h2>
      <p>
        <strong>Solo cookies técnicas.</strong> No usamos cookies de analítica, publicidad ni redes sociales, y la web no
        carga contenido de terceros que las instale: las fuentes tipográficas se sirven desde nuestro propio dominio.
      </p>
      <table>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Para qué</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>sb-…-auth-token</code>
            </td>
            <td>
              Mantener la sesión de los usuarios del panel. Solo se crea al iniciar sesión, nunca al visitar la web
              pública.
            </td>
            <td>Hasta cerrar sesión o caducar la sesión</td>
          </tr>
        </tbody>
      </table>
      <p>
        Según el artículo 22.2 de la LSSI-CE, estas cookies están exentas de consentimiento porque son estrictamente
        necesarias para prestar el servicio que solicitas. Por eso esta web no muestra un aviso de cookies.
      </p>

      <h2>3. Cómo desactivarlas</h2>
      <p>
        Puedes bloquear o borrar las cookies desde la configuración de tu navegador. Si bloqueas las técnicas, la web
        pública seguirá funcionando, pero no podrás iniciar sesión en el panel.
      </p>

      <h2>4. Cambios</h2>
      <p>
        Si en el futuro incorporamos cookies que requieran tu consentimiento, actualizaremos esta política y te lo
        pediremos antes de instalarlas. Para cualquier duda, escríbenos a <Dato campo="email" /> o consulta la{" "}
        <Link href="/privacidad">política de privacidad</Link>.
      </p>
    </DocumentoLegal>
  );
}

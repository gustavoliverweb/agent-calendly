import Link from "next/link";
import { DocumentoLegal, metadataLegal } from "@/components/legal/documento-legal";
import { Dato, Revisar } from "@/components/legal/huecos";
import { TITULAR } from "@/lib/legal";
import { MARCA } from "@/lib/marca";

export const metadata = metadataLegal(
  "Política de privacidad",
  `Cómo trata ${MARCA.nombre} los datos personales de quienes visitan la web, usan el panel o reciben una llamada.`,
);

export default function Privacidad() {
  return (
    <DocumentoLegal ruta="/privacidad" titulo="Política de privacidad">
      <p>
        Esta política explica qué datos personales tratamos, para qué, durante cuánto tiempo y qué derechos tienes, de
        acuerdo con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li>
          <strong>Responsable:</strong> <Dato campo="razonSocial" />
        </li>
        <li>
          <strong>NIF:</strong> <Dato campo="nif" />
        </li>
        <li>
          <strong>Domicilio:</strong> <Dato campo="domicilio" />
        </li>
        <li>
          <strong>Email:</strong> <Dato campo="email" />
        </li>
        {TITULAR.dpd && (
          <li>
            <strong>Delegado de protección de datos:</strong> <Dato campo="dpd" />
          </li>
        )}
      </ul>

      <h2>2. Qué datos tratamos y para qué</h2>

      <h3>Si nos escribes o solicitas una demo</h3>
      <table>
        <tbody>
          <tr>
            <th scope="row">Datos</th>
            <td>Email, nombre y lo que nos cuentes en el mensaje.</td>
          </tr>
          <tr>
            <th scope="row">Finalidad</th>
            <td>Responder a tu consulta y, si lo pides, enseñarte el servicio.</td>
          </tr>
          <tr>
            <th scope="row">Base jurídica</th>
            <td>Aplicación de medidas precontractuales a petición tuya (art. 6.1.b RGPD).</td>
          </tr>
          <tr>
            <th scope="row">Conservación</th>
            <td>
              <Revisar nota="plazo de conservación de consultas">
                Mientras dure la conversación y, después, un máximo de 12 meses si no llega a contratarse el servicio.
              </Revisar>
            </td>
          </tr>
        </tbody>
      </table>

      <h3>Si eres usuario del panel</h3>
      <table>
        <tbody>
          <tr>
            <th scope="row">Datos</th>
            <td>
              Email, contraseña (guardada solo como huella cifrada) y registro de las acciones relevantes que haces en el
              panel, como borrados o cambios de configuración.
            </td>
          </tr>
          <tr>
            <th scope="row">Finalidad</th>
            <td>Darte acceso al panel, mantener la seguridad de la cuenta y poder auditar los cambios.</td>
          </tr>
          <tr>
            <th scope="row">Base jurídica</th>
            <td>Ejecución del contrato de servicio (art. 6.1.b RGPD) e interés legítimo en la seguridad (art. 6.1.f).</td>
          </tr>
          <tr>
            <th scope="row">Conservación</th>
            <td>Mientras la cuenta esté activa y, después, durante los plazos de prescripción de responsabilidades.</td>
          </tr>
        </tbody>
      </table>

      <h3>Si recibes una llamada del agente</h3>
      <p>
        <Revisar nota="papel del titular frente a los contactos: encargado de cada cliente o responsable si llama por sí mismo">
          El agente llama en nombre de la empresa que te contacta, que es la responsable de esos datos y quien decide a
          quién se llama. Nosotros los tratamos por su cuenta, como encargado del tratamiento (art. 28 RGPD), y solo para
          prestarle el servicio. Para ejercer tus derechos puedes dirigirte a esa empresa o escribirnos y le haremos
          llegar tu solicitud.
        </Revisar>
      </p>
      <table>
        <tbody>
          <tr>
            <th scope="row">Datos</th>
            <td>
              Nombre, teléfono y, si lo hay, email; el consentimiento con su fecha y origen; la transcripción y el resumen
              de la conversación, el resultado de la llamada y la cita que se reserve.
            </td>
          </tr>
          <tr>
            <th scope="row">Finalidad</th>
            <td>Hacer la llamada, conversar contigo, ofrecerte huecos libres y reservar la cita si la aceptas.</td>
          </tr>
          <tr>
            <th scope="row">Base jurídica</th>
            <td>
              En llamadas comerciales, tu consentimiento previo (art. 6.1.a RGPD y art. 66.1.b de la Ley General de
              Telecomunicaciones): sin él, el sistema no permite llamar. En otras llamadas, la que acredite la empresa
              que llama, como una relación contractual previa.
            </td>
          </tr>
          <tr>
            <th scope="row">Conservación</th>
            <td>
              Las transcripciones se borran automáticamente a los 365 días, salvo que la empresa fije un plazo menor. El
              panel no guarda el audio de las llamadas.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        El agente se presenta siempre como asistente virtual al empezar la llamada. Puede clasificar el resultado de la
        conversación (por ejemplo, «cita agendada» o «no interesado»), pero no toma decisiones que produzcan efectos
        jurídicos sobre ti.
      </p>
      <p>
        Si durante la llamada pides que no te vuelvan a llamar, tu teléfono pasa al momento a una lista de exclusión
        permanente y se retira de cualquier lote de llamadas pendiente. Conservamos ese dato con el único fin de respetar
        tu oposición.
      </p>

      <h2>3. Quién más trata los datos</h2>
      <p>
        No vendemos ni cedemos datos a terceros. Para prestar el servicio usamos proveedores que actúan como encargados
        del tratamiento, con contrato conforme al art. 28 RGPD:
      </p>
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Para qué</th>
            <th>Ubicación de los datos</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>Base de datos y acceso al panel</td>
            <td>UE (Fráncfort)</td>
          </tr>
          <tr>
            <td>Render</td>
            <td>Alojamiento de la web y del panel</td>
            <td>UE (Fráncfort); empresa con sede en EE. UU.</td>
          </tr>
          <tr>
            <td>ElevenLabs</td>
            <td>Voz del agente y transcripción de la llamada</td>
            <td>
              <Revisar nota="región de datos contratada en ElevenLabs">EE. UU.</Revisar>
            </td>
          </tr>
          <tr>
            <td>Calendly</td>
            <td>Consulta de disponibilidad y reserva de citas</td>
            <td>EE. UU.</td>
          </tr>
          <tr>
            <td>
              <Dato campo="operadorTelefonico" />
            </td>
            <td>Línea telefónica de las llamadas salientes</td>
            <td>España</td>
          </tr>
        </tbody>
      </table>
      <p>
        <Revisar nota="garantía de cada proveedor según su DPA vigente">
          Cuando un proveedor trata datos fuera del Espacio Económico Europeo, la transferencia se ampara en el Marco de
          Privacidad de Datos UE-EE. UU., si el proveedor está adherido, o en las cláusulas contractuales tipo de la
          Comisión Europea (art. 46 RGPD).
        </Revisar>
      </p>
      <p>Solo comunicaremos datos a autoridades u organismos públicos cuando una ley nos obligue.</p>

      <h2>4. Tus derechos</h2>
      <p>Puedes ejercer en cualquier momento los derechos de:</p>
      <ul>
        <li>acceso a tus datos;</li>
        <li>rectificación de los inexactos;</li>
        <li>supresión, que borra tu contacto, tus llamadas y sus transcripciones, también en el proveedor de voz;</li>
        <li>oposición, incluida la de no volver a recibir llamadas;</li>
        <li>limitación del tratamiento y portabilidad;</li>
        <li>retirada del consentimiento, sin que afecte a lo tratado antes.</li>
      </ul>
      <p>
        Escríbenos a <Dato campo="email" /> indicando qué derecho ejerces y, si se refiere a una llamada, el teléfono en
        el que la recibiste. Responderemos en el plazo de un mes. Si no quedas satisfecho, puedes reclamar ante la Agencia
        Española de Protección de Datos en <a href="https://www.aepd.es">www.aepd.es</a>.
      </p>
      <p>
        Si no quieres recibir llamadas publicitarias de ninguna empresa, puedes inscribirte también en la{" "}
        <a href="https://www.listarobinson.es">Lista Robinson</a>.
      </p>

      <h2>5. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas adecuadas: cifrado en tránsito, control de acceso por usuario,
        registros de actividad sin datos personales completos, borrado automático según los plazos de retención y
        alojamiento principal en la Unión Europea.
      </p>

      <h2>6. Cookies</h2>
      <p>
        Esta web solo usa cookies técnicas necesarias para iniciar sesión en el panel. Tienes el detalle en la{" "}
        <Link href="/cookies">política de cookies</Link>.
      </p>

      <h2>7. Cambios en esta política</h2>
      <p>
        Si cambiamos esta política, publicaremos aquí la nueva versión con su fecha de actualización. Si el cambio es
        relevante, lo comunicaremos también a los usuarios del panel.
      </p>
    </DocumentoLegal>
  );
}

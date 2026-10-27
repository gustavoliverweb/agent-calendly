import Link from "next/link";
import { DocumentoLegal, metadataLegal } from "@/components/legal/documento-legal";
import { Dato, Revisar } from "@/components/legal/huecos";
import { MARCA } from "@/lib/marca";

export const metadata = metadataLegal("Aviso legal", `Titular y condiciones de uso del sitio web de ${MARCA.nombre}.`);

export default function AvisoLegal() {
  return (
    <DocumentoLegal ruta="/aviso-legal" titulo="Aviso legal">
      <h2>1. Titular del sitio web</h2>
      <p>
        En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio
        electrónico (LSSI-CE), se informa de los datos del titular de este sitio web y del servicio {MARCA.nombre}:
      </p>
      <ul>
        <li>
          <strong>Titular:</strong> <Dato campo="razonSocial" />
        </li>
        <li>
          <strong>NIF:</strong> <Dato campo="nif" />
        </li>
        <li>
          <strong>Domicilio:</strong> <Dato campo="domicilio" />
        </li>
        <li>
          <strong>Datos registrales:</strong> <Dato campo="registro" />
        </li>
        <li>
          <strong>Email:</strong> <Dato campo="email" />
        </li>
      </ul>

      <h2>2. Objeto</h2>
      <p>
        Este sitio web presenta {MARCA.nombre}, un servicio que realiza llamadas salientes con un agente de voz basado en
        inteligencia artificial, conversa con los contactos que facilita el cliente y reserva citas en su calendario. El
        acceso al panel de control está limitado a los usuarios a los que el titular da de alta.
      </p>

      <h2>3. Condiciones de uso</h2>
      <p>
        Acceder al sitio web atribuye la condición de usuario e implica aceptar este aviso legal. El usuario se compromete
        a hacer un uso adecuado del sitio y de sus contenidos, conforme a la ley, la buena fe y el orden público, y a no
        emplearlos para actividades ilícitas o que perjudiquen a terceros.
      </p>
      <p>
        Los usuarios del panel son responsables de custodiar sus credenciales y de que los datos de contacto que importan
        se hayan obtenido legítimamente, con el consentimiento o la base jurídica que exija cada campaña.
      </p>

      <h2>4. Propiedad intelectual e industrial</h2>
      <p>
        Los contenidos del sitio (textos, diseño, código, logotipos y marcas) pertenecen al titular o cuenta con licencia
        para usarlos. Queda prohibida su reproducción, distribución o transformación sin autorización expresa, salvo
        para uso personal y privado.
      </p>

      <h2>5. Responsabilidad</h2>
      <p>
        El titular procura que la información del sitio sea exacta y esté actualizada, pero no garantiza la ausencia de
        errores ni la disponibilidad ininterrumpida del servicio. No responde de los daños derivados de un uso indebido
        del sitio ni de interrupciones causadas por terceros o por causas ajenas a su control.
      </p>
      <p>
        Los enlaces a sitios de terceros se ofrecen solo a título informativo. El titular no controla su contenido ni
        responde de él.
      </p>

      <h2>6. Protección de datos y cookies</h2>
      <p>
        El tratamiento de datos personales se describe en la <Link href="/privacidad">política de privacidad</Link> y el
        uso de cookies, en la <Link href="/cookies">política de cookies</Link>.
      </p>

      <h2>7. Legislación aplicable y jurisdicción</h2>
      <p>
        <Revisar nota="fuero aplicable; con consumidores rige su domicilio">
          Este aviso legal se rige por la legislación española. Para cualquier controversia, las partes se someten a los
          juzgados y tribunales que correspondan conforme a la normativa aplicable.
        </Revisar>
      </p>
    </DocumentoLegal>
  );
}

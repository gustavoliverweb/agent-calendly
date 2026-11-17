import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cuerpoLegal } from "@/components/legal/documento-legal";
import { Revisar } from "@/components/legal/huecos";
import { LogoMarca } from "@/components/marca/logo-marca";
import { contextoDominio, type DatosLegalesEmpresa, type EmpresaDominio } from "@/lib/dominio/contexto";
import { ACTUALIZACION_LEGAL, TEXTOS_REVISADOS } from "@/lib/legal";
import { cn } from "@/lib/utils";

/**
 * Páginas legales en el dominio de una empresa (marca blanca, plan SaaS §4.3).
 * proxy.ts reescribe aquí /aviso-legal, /privacidad y /cookies cuando el host
 * es de una empresa; en el dominio de la plataforma esta ruta no existe.
 */

const DOCUMENTOS = {
  "aviso-legal": { titulo: "Aviso legal", corto: "Aviso legal" },
  privacidad: { titulo: "Política de privacidad", corto: "Privacidad" },
  cookies: { titulo: "Política de cookies", corto: "Cookies" },
} as const;
type Documento = keyof typeof DOCUMENTOS;

const esDocumento = (d: string): d is Documento => d in DOCUMENTOS;

const ETIQUETAS: Record<keyof DatosLegalesEmpresa, string> = {
  razonSocial: "Razón social",
  nif: "NIF",
  domicilio: "Domicilio",
  registro: "Datos registrales",
  email: "Email de contacto",
};

const OBLIGATORIOS: (keyof DatosLegalesEmpresa)[] = ["razonSocial", "nif", "domicilio", "email"];

function esBorrador(legal: DatosLegalesEmpresa) {
  return !TEXTOS_REVISADOS || OBLIGATORIOS.some((c) => !legal[c]?.trim());
}

async function empresaDelDominio(): Promise<EmpresaDominio> {
  const ctx = await contextoDominio();
  if (ctx.tipo !== "empresa") notFound();
  return ctx.empresa;
}

export async function generateMetadata({ params }: PageProps<"/legal-empresa/[documento]">): Promise<Metadata> {
  const { documento } = await params;
  const ctx = await contextoDominio();
  if (!esDocumento(documento) || ctx.tipo !== "empresa") return { robots: { index: false, follow: false } };
  const { marca, legal } = ctx.empresa;
  return {
    title: { absolute: `${DOCUMENTOS[documento].titulo} · ${marca.nombre}` },
    ...(marca.faviconUrl ? { icons: { icon: marca.faviconUrl } } : {}),
    ...(esBorrador(legal) ? { robots: { index: false, follow: false } } : {}),
  };
}

export default function LegalEmpresaPage({ params }: PageProps<"/legal-empresa/[documento]">) {
  return (
    <Suspense fallback={<main className="flex-1 bg-white" />}>
      <Pagina params={params} />
    </Suspense>
  );
}

async function Pagina({ params }: Pick<PageProps<"/legal-empresa/[documento]">, "params">) {
  const { documento } = await params;
  if (!esDocumento(documento)) notFound();
  const empresa = await empresaDelDominio();
  const { marca, legal } = empresa;
  const dato = (campo: keyof DatosLegalesEmpresa) => <DatoEmpresa valor={legal[campo]} etiqueta={ETIQUETAS[campo]} />;
  const titular = legal.razonSocial ?? marca.nombre;

  const contenido: Record<Documento, ReactNode> = {
    "aviso-legal": (
      <>
        <h2>1. Titular</h2>
        <p>
          En cumplimiento del artículo 10 de la Ley 34/2002 (LSSI-CE), se informa de los datos del titular de este sitio,
          el panel de llamadas de {marca.nombre}:
        </p>
        <ul>
          <li>
            <strong>Titular:</strong> {dato("razonSocial")}
          </li>
          <li>
            <strong>NIF:</strong> {dato("nif")}
          </li>
          <li>
            <strong>Domicilio:</strong> {dato("domicilio")}
          </li>
          {legal.registro && (
            <li>
              <strong>Datos registrales:</strong> {legal.registro}
            </li>
          )}
          <li>
            <strong>Email:</strong> {dato("email")}
          </li>
        </ul>

        <h2>2. Objeto y acceso</h2>
        <p>
          Este sitio es la herramienta interna de {titular} para gestionar llamadas salientes con un agente de voz basado en
          inteligencia artificial y la reserva de citas. Solo pueden acceder los usuarios a los que {titular} da de alta,
          que deben custodiar sus credenciales y usar el sitio conforme a la ley y a las instrucciones del titular.
        </p>
        <p>
          <Revisar nota="nombrar o no al proveedor tecnológico">
            La plataforma la presta un proveedor tecnológico por encargo del titular, sin acceso a los datos salvo para
            prestar el servicio.
          </Revisar>
        </p>

        <h2>3. Responsabilidad</h2>
        <p>
          El titular procura que el sitio funcione de forma continua y segura, pero no garantiza la ausencia de
          interrupciones ni responde de los daños causados por un uso indebido de las credenciales.
        </p>

        <h2>4. Protección de datos y cookies</h2>
        <p>
          El tratamiento de datos personales se describe en la <Link href="/privacidad">política de privacidad</Link> y el
          uso de cookies, en la <Link href="/cookies">política de cookies</Link>.
        </p>

        <h2>5. Legislación aplicable</h2>
        <p>
          <Revisar nota="fuero aplicable">Este aviso legal se rige por la legislación española.</Revisar>
        </p>
      </>
    ),
    privacidad: (
      <>
        <p>
          Esta política explica qué datos personales se tratan en este sitio y en las llamadas que hace el agente de voz de{" "}
          {marca.nombre}, de acuerdo con el RGPD y la LOPDGDD.
        </p>

        <h2>1. Responsable del tratamiento</h2>
        <ul>
          <li>
            <strong>Responsable:</strong> {dato("razonSocial")}
          </li>
          <li>
            <strong>NIF:</strong> {dato("nif")}
          </li>
          <li>
            <strong>Domicilio:</strong> {dato("domicilio")}
          </li>
          <li>
            <strong>Email:</strong> {dato("email")}
          </li>
        </ul>

        <h2>2. Qué datos se tratan y para qué</h2>
        <h3>Usuarios del panel</h3>
        <p>
          Email, contraseña cifrada y registro de las acciones realizadas en el panel, para dar acceso, garantizar la
          seguridad y auditar los cambios. Base jurídica: la relación laboral o de servicios con el titular y su interés
          legítimo en la seguridad (art. 6.1.b y 6.1.f RGPD).
        </p>
        <h3>Personas a las que se llama</h3>
        <p>
          Nombre, teléfono, email y empresa facilitados por el titular; la grabación, transcripción y resumen de la
          llamada; y los datos de la cita, si se reserva. Finalidad: contactar, informar de los servicios del titular y
          agendar citas. Base jurídica:{" "}
          <Revisar nota="consentimiento o interés legítimo según el tipo de campaña">
            el consentimiento del interesado o, en llamadas a empresas, el interés legítimo del titular, con su origen
            documentado
          </Revisar>
          . El agente se identifica como asistente virtual al comenzar la llamada y deja de llamar a quien lo pida.
        </p>

        <h2>3. Conservación</h2>
        <p>
          <Revisar nota="plazos que fije el titular">
            Los datos de las llamadas se conservan el tiempo configurado por el titular y, después, se eliminan. Las
            personas que piden no ser llamadas se conservan en una lista de exclusión para respetar su decisión.
          </Revisar>
        </p>

        <h2>4. Encargados del tratamiento</h2>
        <p>
          El proveedor de la plataforma trata los datos por cuenta del titular (art. 28 RGPD), con estos subencargados:
          alojamiento y base de datos (Render, Supabase, en la UE), voz e inteligencia artificial (ElevenLabs), calendario
          (Calendly) y el operador de telefonía del titular.{" "}
          <Revisar nota="transferencias internacionales y garantías">
            Cuando un proveedor trata datos fuera del Espacio Económico Europeo, lo hace con cláusulas contractuales tipo o
            una decisión de adecuación.
          </Revisar>
        </p>

        <h2>5. Derechos</h2>
        <p>
          Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad
          escribiendo a {dato("email")}. Si no quedas satisfecho, puedes reclamar ante la Agencia Española de Protección
          de Datos (aepd.es).
        </p>
      </>
    ),
    cookies: (
      <>
        <h2>1. Qué cookies se usan</h2>
        <p>
          <strong>Solo cookies técnicas</strong>, necesarias para iniciar sesión en el panel. No hay cookies de analítica,
          publicidad ni redes sociales.
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
              <td>Mantener la sesión de los usuarios del panel.</td>
              <td>Hasta cerrar sesión o caducar la sesión</td>
            </tr>
          </tbody>
        </table>
        <p>
          Según el artículo 22.2 de la LSSI-CE, estas cookies están exentas de consentimiento porque son estrictamente
          necesarias para prestar el servicio.
        </p>
        <h2>2. Cómo desactivarlas</h2>
        <p>
          Puedes bloquearlas o borrarlas desde tu navegador, pero entonces no podrás iniciar sesión. Para cualquier duda,
          escribe a {dato("email")}.
        </p>
      </>
    ),
  };

  const pendientes = OBLIGATORIOS.filter((c) => !legal[c]?.trim());

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white text-neutral-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <LogoMarca marca={marca} />
        <Link href="/login" className="text-sm text-neutral-500 hover:text-neutral-950">
          Entrar
        </Link>
      </header>
      <main className="flex-1 px-6 pt-12 pb-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_2.2fr]">
          <nav aria-label="Documentos legales" className="flex flex-wrap gap-2 lg:sticky lg:top-12 lg:flex-col lg:items-start lg:self-start">
            {(Object.keys(DOCUMENTOS) as Documento[]).map((d) => (
              <Link
                key={d}
                href={`/${d}`}
                aria-current={d === documento ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
                  d === documento
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-950",
                )}
              >
                {DOCUMENTOS[d].corto}
              </Link>
            ))}
          </nav>
          <article className="min-w-0 max-w-3xl">
            <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] leading-none font-normal tracking-[-0.045em]">
              {DOCUMENTOS[documento].titulo}
            </h1>
            <p className="mt-6 font-mono text-[11px] tracking-[0.22em] text-neutral-400 uppercase">
              Última actualización · {ACTUALIZACION_LEGAL}
            </p>
            {esBorrador(legal) && (
              <div role="note" className="mt-10 rounded-2xl border border-dashed border-amber-500 bg-amber-50 p-5 text-sm text-amber-950">
                <p className="font-medium">Borrador: esta página no se indexa hasta completarla.</p>
                {pendientes.length > 0 && (
                  <p className="mt-2">
                    Faltan datos de {marca.nombre} (se rellenan en el panel, sección Marca):{" "}
                    {pendientes.map((c) => ETIQUETAS[c]).join(", ")}.
                  </p>
                )}
              </div>
            )}
            <div className={cn(cuerpoLegal, "mt-12")}>{contenido[documento]}</div>
          </article>
        </div>
      </main>
    </div>
  );
}

function DatoEmpresa({ valor, etiqueta }: { valor: string | null; etiqueta: string }) {
  if (valor?.trim()) return <>{valor}</>;
  return (
    <mark className="rounded-sm border border-dashed border-amber-500 bg-amber-50 px-1 font-mono text-[0.8em] text-amber-900">
      [{etiqueta}]
    </mark>
  );
}
